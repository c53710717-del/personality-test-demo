#!/usr/bin/env python3
"""Render a markdown audit report from structured Figma copy findings."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a markdown Figma copy audit report."
    )
    parser.add_argument("--input", required=True, help="Path to findings JSON.")
    parser.add_argument("--output", help="Optional markdown output path.")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Input file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def encode_node_id(node_id: str) -> str:
    return urllib.parse.quote(node_id, safe="")


def build_figma_link(
    file_url: str | None,
    file_key: str | None,
    node_id: str | None,
) -> str | None:
    if not node_id:
        return None
    if file_url:
        parsed = urllib.parse.urlparse(file_url)
        query = urllib.parse.parse_qs(parsed.query)
        query["node-id"] = [node_id]
        new_query = urllib.parse.urlencode(query, doseq=True)
        return urllib.parse.urlunparse(parsed._replace(query=new_query))
    if file_key:
        encoded = encode_node_id(node_id)
        return f"https://www.figma.com/file/{file_key}/Audit?node-id={encoded}"
    return None


def severity_rank(value: str) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(value.lower(), 3)


def markdown_escape(text: Any) -> str:
    if text is None:
        return ""
    return str(text).replace("|", "\\|").replace("\n", "<br>")


def format_timestamp(value: str | None) -> str:
    if value:
        return value
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def summarise_items(items: list[dict[str, Any]]) -> Counter:
    counter: Counter[str] = Counter()
    for item in items:
        for issue in item.get("issues", []):
            counter[issue.get("severity", "unknown").lower()] += 1
    return counter


def render_report(payload: dict[str, Any]) -> str:
    scope = payload.get("scope", {})
    items = payload.get("items", [])
    summary = payload.get("summary", {})
    themes = payload.get("themes", [])
    patches = payload.get("patches", [])

    severity_counts = summarise_items(items)
    if not summary:
        summary = {
            "text_nodes_reviewed": len(items),
            "findings": sum(severity_counts.values()),
            "high": severity_counts.get("high", 0),
            "medium": severity_counts.get("medium", 0),
            "low": severity_counts.get("low", 0),
        }

    lines: list[str] = []
    lines.append(f"# {payload.get('report_title', 'Figma Content Audit')}")
    lines.append("")
    lines.append("## Overview")
    lines.append("")
    lines.append(
        f"- Generated at: `{format_timestamp(payload.get('generated_at'))}`"
    )
    lines.append(
        f"- Guideline source: {payload.get('guideline_source', 'Not provided')}"
    )
    lines.append(
        f"- Guideline status: `{payload.get('guideline_status', 'unknown')}`"
    )
    lines.append(f"- File: `{scope.get('file_name', 'Unknown file')}`")
    if scope.get("page_names"):
        page_names = ", ".join(scope["page_names"])
        lines.append(f"- Pages: `{page_names}`")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(
        f"- Reviewed `{summary.get('text_nodes_reviewed', len(items))}` text nodes and found `{summary.get('findings', sum(severity_counts.values()))}` issues."
    )
    lines.append(
        f"- Severity split: high `{summary.get('high', severity_counts.get('high', 0))}`, medium `{summary.get('medium', severity_counts.get('medium', 0))}`, low `{summary.get('low', severity_counts.get('low', 0))}`."
    )
    if themes:
        lines.append("")
        lines.append("## Cross-Cutting Patterns")
        lines.append("")
        for theme in themes:
            lines.append(f"- {theme}")

    lines.append("")
    lines.append("## Findings")
    lines.append("")
    lines.append(
        "| Severity | Location | Original Copy | Problem | Suggested Copy | Link |"
    )
    lines.append(
        "| --- | --- | --- | --- | --- | --- |"
    )

    rendered_rows = 0
    for item in items:
        page_name = item.get("page_name", "")
        frame_name = item.get("frame_name", "")
        node_name = item.get("node_name", "")
        location = " / ".join(part for part in [page_name, frame_name, node_name] if part)
        link = item.get("figma_link") or build_figma_link(
            scope.get("file_url"), scope.get("file_key"), item.get("node_id")
        )
        for issue in sorted(
            item.get("issues", []),
            key=lambda issue: (
                severity_rank(issue.get("severity", "")),
                issue.get("category", ""),
            ),
        ):
            rendered_rows += 1
            link_md = f"[Open]({link})" if link else ""
            lines.append(
                "| {severity} | {location} | {original} | {problem} | {suggestion} | {link} |".format(
                    severity=markdown_escape(issue.get("severity", "")).upper(),
                    location=markdown_escape(location or item.get("node_id", "")),
                    original=markdown_escape(item.get("original_text", "")),
                    problem=markdown_escape(issue.get("problem", "")),
                    suggestion=markdown_escape(issue.get("suggested_text", "")),
                    link=link_md,
                )
            )

    if rendered_rows == 0:
        lines.append("| NONE | n/a | n/a | No issues found. | n/a | n/a |")

    if patches:
        lines.append("")
        lines.append("## Patch Payload")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(patches, ensure_ascii=False, indent=2))
        lines.append("```")

    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    payload = load_json(Path(args.input))
    report = render_report(payload)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
    else:
        sys.stdout.write(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
