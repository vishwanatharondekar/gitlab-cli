# Gitlab-cli

Gitlab-cli is a command line utility created in nodejs. 

## Installation

Install it using npm:

    npm install https://github.com/vishwanatharondekar/gitlab-cli.git -g
    
## Environment variables
    
    GITLAB_URL=http://gitlab.yourcompany.com 
    GITLAB_TOKEN=abcdefghijskl-1230

Find your gitlab token at [http://gitlab.yourcompany.com/profile/account](http://gitlab.yourcompany.com/profile/account)

## Usage

    gitlab-cli command [options]

To get a list of available commands

    gitlab-cli --help


## Commands available

    create-merge-request [options]   Create merge request on gitlab
    browse                           Open current branch page in gitlab
    compare [options]                Open compare page between two branches
    open-merge-requests              Opens merge request page for the repo.

Check help of each command like following 

    gitlab-cli create-merge-request --help

### Running example
   
    gitlab-cli create-merge-request -b feature/feature-name -t develop

Above will create pull request for merging feature/feature-name in develop.

### Options for create-merge-request

    Options:

    -h, --help                output usage information
    -b, --base [optional]     Base branch name
    -t, --target [optional]   Target branch name
    -m, --message [optional]  Title of the merge request
    -l --labels [optional]    Comma separated list of labels to assign while creating request 
    -e, --edit [optional]     If supplied opens edit page of merge request. Opens merge request page otherwise
###Features supported 

1. Base branch is optional. If base branch is not provided. Current branch is used as base branch.
2. target branch is optional. If target branch is not provided, default branch of the repo in gitlab will be used.
3. Created pull request page will be opened automatically after successful creation.
4. If title is not supported with -m option value. It will be taken from in place editor opened. First line is taken as title.
5. In the editor opened third line onwards takes as description.
6. Comma separated list of labels can be provided with its option.


##TODO 

#### Fixes
1. Check if there are any local commits which are not pushed.
