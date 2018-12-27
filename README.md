gitlab-cli
==================

gitlab-cli is a command line utility created in JavaScript. Inspired from [hub](https://github.com/github/hub). It tries to provide commands which makes working with gitlab from the command line easier. 

Creating a merge request with gitlab-cli is as simple as

```sh
$ lab merge-request
```

## Installation

Install it using npm

```sh
$ npm install git-lab-cli -g
```

## Usage

```sh
$ lab command [options]
```

To get a list of available commands

```sh
$ lab --help
```

## Commands available

    browse                    Open current branch page in gitlab
    compare [options]         Open compare page between two branches
    merge-request [options]   Create merge request on gitlab
    merge-requests [options]  Opens merge request page for the repo.

Check help of each command like following 

```sh
$ lab merge-request --help
```

### Running example

```sh
$ lab merge-request -b feature/feature-name -t develop
```

Above will create merge request for merging feature/feature-name in develop.

### Options for create-merge-request

    -b, --base [optional]                  Base branch name
    -t, --target [optional]                Target branch name
    -m, --message [optional]               Title of the merge request
    -a, --assignee [optional]              User to assign merge request to
    -l, --labels [optional]                Comma separated list of labels to assign while creating merge request
    -r, --remove_source_branch [optional]  Flag indicating if a merge request should remove the source branch when merging
    -s, --squash [optional]                Squash commits into a single commit when merging
    -e, --edit [optional]                  If supplied opens edit page of merge request. Opens merge request page otherwise
    -p, --print [optional]                 If supplied print the url of the merge request. Opens merge request page otherwise
    -v, --verbose [optional]               Detailed logging emitted on console for debug purpose
    -h, --help                             output usage information

## Configurations

gitlab-cli **captures configurations needed for itself on the first run**. Just run the command you want to run and it will capture the information needed. 

You can also set the configurations yourself as git config (project specific) or environment variables (global).

### git config

Setting git config allows you to provide separate configurations for each gitlab repository. 

```sh
$ git config --add gitlab.url "https://gitlab.yourcompany.com"
$ git config --add gitlab.token "abcdefghijskl-1230"
```

Find your gitlab token at [https://gitlab.yourcompany.com/profile/account](http://gitlab.yourcompany.com/profile/account)

### Environment variables

Setting environment variables allows you to provide global configurations which will be used for all your gitlab repositories when using gitlab-cli. 

    GITLAB_URL=https://gitlab.yourcompany.com
    GITLAB_TOKEN=abcdefghijskl-1230

Find your gitlab token at [https://gitlab.yourcompany.com/profile/account](http://gitlab.yourcompany.com/profile/account)

### Features supported 

1. Base branch is optional. If base branch is not provided. Current branch is used as base branch.
2. Target branch is optional. If target branch is not provided, default branch of the repo in gitlab will be used. 
3. Created merge request page will be opened automatically after successful creation.
4. If title is not supported with -m option value. It will be taken from in place editor opened. First line is taken as title.
5. In place editor opened contains latest commit message.
6. In the editor opened third line onwards takes as description.
7. Comma separated list of labels can be provided with its option.
8. Supports forks. If base branch and target branch are on different remotes. Merge request will be created between forks.
9. Supports setting assignee for merge request. 
