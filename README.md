# Changed Lines Count Labeler

Automatically label new pull requests based on the changed lines count.

## Usage

### Create `.github/changed-lines-count-labeler.yml`

Create a `.github/changed-lines-count-labeler.yml` file with a list of labels and [minimatch](https://github.com/isaacs/minimatch) globs to match to apply the label.

The key is the name of the label in your repository that you want to add (eg: "small", "large") and the value is the minimum and maximum count of lines.

#### Examples

```yml
# Add 'small' to any changes below 10 lines
small:
  max: 9

# Add 'medium' to any changes between 10 and 100 lines
medium:
  min: 10
  max: 99

# Add 'large' to any changes for more than 100 lines
large:
  min: 100
```

### Create Workflow

Create a workflow (eg: `.github/workflows/changed-lines-count-labeler.yml` see [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) to utilize the labeler action with content:

```yml
name: "Changed Lines Count Labeler"
on: [pull_request]

jobs:
  changed-lines-count-labeler:
    runs-on: ubuntu-latest
    name: An action for automatically labelling pull requests based on the changed lines count
    steps:
    - name: Set a label
      uses: vkirilichev/changed-lines-count-labeler@v0.2
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        configuration-path: .github/changed-lines-count-labeler.yml
```

_Note: This grants access to the `GITHUB_TOKEN` so the action can make calls to GitHub's rest API_

#### Inputs

Various inputs are defined in [`action.yml`](action.yml) to let you configure the labeler:

| Name | Description | Default |
| - | - | - |
| `repo-token` | Token to use to authorize label changes. Typically the GITHUB_TOKEN secret, with `contents:read` and `pull-requests:write` access | N/A |
| `configuration-path` | The path to the label configuration file | `.github/changed-lines-count-labeler.yml` |
