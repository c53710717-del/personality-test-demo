# Report Schema

Use this JSON shape as input to `scripts/render_report.py`.

```json
{
  "report_title": "Figma Content Audit",
  "guideline_source": "https://sites.google.com/zoom.us/design-system/principles-and-guidelines/content-guidelines/content-patterns",
  "guideline_status": "fallback-checklist",
  "generated_at": "2026-04-09T12:00:00Z",
  "scope": {
    "file_name": "Billing Settings",
    "file_key": "abc123",
    "file_url": "https://www.figma.com/file/abc123/Billing-Settings",
    "page_names": ["Upgrade flow"]
  },
  "summary": {
    "text_nodes_reviewed": 12,
    "findings": 4,
    "high": 1,
    "medium": 2,
    "low": 1
  },
  "themes": [
    "CTAs are generic across the billing flow.",
    "Error messages describe the problem but not the next step."
  ],
  "items": [
    {
      "page_name": "Upgrade flow",
      "frame_name": "Payment error modal",
      "node_name": "Primary Button",
      "node_id": "321:654",
      "original_text": "Submit",
      "figma_link": "https://www.figma.com/file/abc123/Billing-Settings?node-id=321%3A654",
      "issues": [
        {
          "severity": "medium",
          "category": "Action alignment",
          "problem": "The CTA does not tell the user what will happen.",
          "rationale": "Specific verbs reduce hesitation in high-friction flows.",
          "suggested_text": "Try payment again"
        }
      ]
    }
  ],
  "patches": [
    {
      "node_id": "321:654",
      "original_text": "Submit",
      "suggested_text": "Try payment again"
    }
  ]
}
```

## Notes

- `guideline_status` should be `verified` only when the Zoom page contents were actually reviewed.
- `patches` should only include one suggestion per node. If multiple suggestions are plausible, omit the node from `patches` and keep the discussion in `items`.
- `figma_link` is optional in the JSON. The renderer will synthesize one when enough scope data is present.

