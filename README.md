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

    gitlab command [options]

To get a list of available commands

    gitlab-cli --help


## Commands

This gitlab-cli currently supports only one command.

To get help use following 

    gitlab-cli create-merge-request --help

### Options for create-merge-request

    Options:

    -h, --help                output usage information
    -b, --base [optional]     Base branch name
    -t, --target [optional]   Target branch name
    -m, --message [optional]  Title of the merge request
    
###Features supported 

1. Base branch is optional. If base branch is not provided. Current branch is used as base branch.
2. target branch is optional. If target branch is not provided, default branch of the repo in gitlab will be used.
3. Created pull request page will be opened automatically after successful creation.


##TODO 

#### Fixes
1. Check if there are any local commits which are not pushed.
2. Check if no remote found for the branch. Throw error to set remote tracking branch.
3. Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.

####Commands 

1. browse command - Open current branch on gitlab
2. compare command - Open compare page on gitlab
3. open-merge-request - Open merge requests page of the current repo.

