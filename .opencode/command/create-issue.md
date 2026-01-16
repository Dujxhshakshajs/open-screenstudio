---
description: Create a GitHub issue with duplicate detection
---

You are tasked with creating a GitHub issue based on the user's input. Follow these steps carefully:

## Step 1: Fetch existing issues

First, get all open issues to check for duplicates:

```bash
gh issue list --state open --limit 100 --json number,title,body,labels
```

## Step 2: Analyze the user's request

The user wants to report/request the following:

$ARGUMENTS

## Step 3: Check for duplicates

Review the existing issues and determine if a similar issue already exists. Consider:
- Similar titles or descriptions
- Related feature requests or pain points
- Issues that address the same underlying problem

If a duplicate or very similar issue exists:
- Report the existing issue number and URL
- Explain why it's a duplicate
- DO NOT create a new issue
- Suggest the user comment on the existing issue instead

## Step 4: Determine issue type and create

If no duplicate exists, analyze the user's input and determine the best issue template:

### Issue Templates Available:

1. **Feature Request** (`[Feature]: title`)
   - Labels: `enhancement`, `needs-triage`
   - For: New features the user wants to see
   
2. **Missing Feature** (`[Missing]: title`)
   - Labels: `enhancement`, `missing-feature`, `needs-triage`
   - For: Features that don't exist in any screen recording software
   
3. **Pain Point** (`[Pain Point]: title`)
   - Labels: `feedback`, `pain-point`, `needs-triage`
   - For: Frustrations with existing screen recording software
   
4. **General Feedback** (`[Feedback]: title`)
   - Labels: `feedback`, `needs-triage`
   - For: Thoughts that don't fit other categories

### Available Labels:
- `bug`, `documentation`, `enhancement`, `good first issue`, `help wanted`
- `feedback`, `missing-feature`, `pain-point`, `needs-triage`
- `priority: critical`, `priority: high`, `priority: medium`, `priority: low`
- `type: architecture`, `type: feature`, `type: infrastructure`, `type: documentation`
- `discussion`

## Step 5: Create the issue

Create the issue using gh cli:

```bash
gh issue create --title "[Type]: Concise title" --body "Well-structured body following the template" --label "label1,label2"
```

The body should be well-formatted markdown that follows the structure of the chosen template, filling in the relevant sections based on the user's input.

## Output

Report the result:
- If duplicate found: Show the existing issue URL and explain
- If created: Show the new issue URL and summarize what was created
