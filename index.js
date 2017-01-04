#!/usr/bin/env node
const program = require('commander');
var gitlab = require('gitlab');
var exec = require('child_process').exec;
var editor = require('editor');
var fs = require('fs');
var open = require("open");
var Promise = require('promise');
var URL = require('url');
var colors = require('colors');

if (!process.env.GITLAB_URL) {
  console.error(colors.red('Env variable GITLAB_URL is not set. Please set env variable GITLAB_URL'));
  console.error('Eg GITLAB_URL=http://gitlab.yourcompany.com');
  process.exit(1);
}

if (!process.env.GITLAB_TOKEN) {
  console.error(colors.red('Please set env variable GITLAB_TOKEN'));
  console.error('Find your token at http://gitlab.yourcompany.com/profile/account');
  process.exit(1);
}

var projectDir = process.cwd();
var gitlabURL = process.env.GITLAB_URL;

var gitlab = require('gitlab')({
  url: gitlabURL,
  token: process.env.GITLAB_TOKEN
});

function getMergeRequestTitle(title){
  var promise = new Promise(function (resolve, reject) {
      if(title){
        resolve(title);
      } else {
      exec('git log -1 --pretty=%B > .git/PULL_REQUEST_TITLE',  function(error, remote, stderr){
        editor('.git/PULL_REQUEST_TITLE',  function (code, sig) {
          fs.readFile('.git/PULL_REQUEST_TITLE', 'utf8', function(err, data){
            title = data;
            resolve(title);
          });
        });
      });
    }
  });
  return promise;
}

function getBaseBranchName(baseBranchName) {
  var promise = new Promise(function (resolve, reject) {
    if (baseBranchName) {
      resolve(baseBranchName);
    } else {
      exec('git rev-parse --abbrev-ref HEAD', { cwd: projectDir }, function (error, stdout, stderr) {
        var curBranchName = stdout.replace('\n', '');
        resolve(curBranchName);
      });
    }
  });
  return promise;
}

function getRemoteForBranch(branchName) {
  var promise = new Promise(function (resolve, reject) {
    exec('git config branch.' + branchName.trim() + '.remote', { cwd: projectDir }, function (error, remote, stderr) {
      resolve(remote.trim());
    });
  });
  return promise;
}

function getURLOfRemote(remote) {
  var promise = new Promise(function (resolve, reject) {
    exec('git config remote.' + remote.trim() + '.url', { cwd: projectDir }, function (err, remoteURL, stderr) {
      resolve(remoteURL);
    });
  });
  return promise;
}

function getProjectInfo(projectName) {
  var promise = new Promise(function (resolve, reject) {
    gitlab.projects.show(projectName, function (project) {
      resolve(project);
    });
  });
  return promise;
}

function browse(options) {
  getBaseBranchName().then(function (curBranchName) {
    getRemoteForBranch(curBranchName).then(function (remote) {
      if (!remote) {
        console.error(colors.red('Branch ' + curBranchName + " is not tracked by any remote branch."));
        console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
        console.log('Eg: `git branch --set-upstream foo upstream/foo`')
      }

      getURLOfRemote(remote).then(function (remoteURL) {

        //TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.
        var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");
        var projectName = remoteURL.match(regexParseProjectName)[1];

        open(gitlabURL + "/" + projectName + "/tree/" + curBranchName);
      });

    });
  });
}

function compare(options) {

  getBaseBranchName(options.base).then(function (baseBranch) {

    getRemoteForBranch(baseBranch).then(function (remote) {

      if (!remote) {
        console.error(colors.red('Branch ' + baseBranch + " is not tracked by any remote branch."));
        console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
        console.log('Eg: `git branch --set-upstream foo upstream/foo`')
        process.exit(1);
      }

      getURLOfRemote(remote).then(function (remoteURL) {

        //TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.
        var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");

        var projectName = remoteURL.match(regexParseProjectName)[1];
        gitlab.projects.show(projectName, function (project) {
          var defaultBranch = project.default_branch;
          var targetBranch = options.target || defaultBranch;
          var sourceBranch = baseBranch;
          var projectId = project.id;
          open(gitlabURL + "/" + projectName + "/compare/" + targetBranch + "..." + sourceBranch)
        });

      });
    });
  });
}

function openMergeRequests(options) {
  getBaseBranchName(options.base).then(function (baseBranch) {
    getRemoteForBranch(baseBranch).then(function (remote) {

      if (!remote) {
        console.error(colors.red('Branch ' + baseBranch + " is not tracked by any remote branch."));
        console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
        console.log('Eg: `git branch --set-upstream foo upstream/foo`')
        process.exit(1);
      }

      getURLOfRemote(remote).then(function (remoteURL) {

        //TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.
        var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");
        var projectName = remoteURL.match(regexParseProjectName)[1];

        open(gitlabURL + "/" + projectName + "/merge_requests");
      });
    });
  });
}

function createMergeRequest(options) {

  getBaseBranchName(options.base).then(function (baseBranch) {

    getRemoteForBranch(baseBranch).then(function (remote) {

      if (!remote) {
        console.error(colors.red('Branch ' + baseBranch + " is not tracked by any remote branch."));
        console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
        console.log('Eg: `git branch --set-upstream foo upstream/foo`');
        process.exit(1);
      }

      getURLOfRemote(remote).then(function (remoteURL) {

        var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");
        var gitlabHost = URL.parse(gitlabURL).host;

        if (remoteURL.indexOf(gitlabHost) == -1) {
          console.error(colors.red('Remote at which ' + baseBranch + " is tracked is not a gitlab repository at " + gitlabURL));
          process.exit(1);
        }


        var match = remoteURL.match(regexParseProjectName);
        if (match) {
          var projectName = match[1];
        } else {
          console.error(colors.red('Remote at which ' + baseBranch + " is tracked, It's URL doesn't seem to end with .git . It is assumed that your remote URL will end with .git in this utility. "));
          console.log('Please contact developer if this is a valid gitlab repository.');
          process.exit(1);
        }

        gitlab.projects.show(projectName, function (project) {
          var defaultBranch = project.default_branch;
          var targetBranch = options.target || defaultBranch;
          var sourceBranch = baseBranch;
          var projectId = project.id;
          var labels = options.labels || "";
          var title = "";
          getRemoteForBranch(targetBranch).then(function (targetRemote) {
            getURLOfRemote(targetRemote).then(function (targetRemoteUrl) {
              var targetMatch = targetRemoteUrl.match(regexParseProjectName);
              if (targetMatch) {
                var targetProjectName = targetMatch[1];
              } else {
                console.error(colors.red('Remote at which ' + targetBranch + " is tracked, It's URL doesn't seem to end with .git . It is assumed that your remote URL will end with .git in this utility. "));
                console.log('Please contact developer if this is a valid gitlab repository.');
                process.exit(1);
              }
              gitlab.projects.show(targetProjectName, function (targetProject) {
                var targetProjectId = targetProject.id;

                getMergeRequestTitle(options.message).then(function (userMessage) {

                  var title = userMessage.split("\n")[0];
                  var description = userMessage.split("\n").slice(2).join("    \n")

                  var mergeRequestURL = gitlabURL + "/api/v3/projects/" + projectId + "/merge_requests";
                  gitlab.projects.post("projects/" + projectId + "/merge_requests", {
                    id: projectId,
                    source_branch: sourceBranch,
                    target_branch: targetBranch,
                    title: title,
                    description: description,
                    labels: labels,
                    target_project_id: targetProjectId
                  }, function (err, response, body) {
                    var mergeRequestResponse = response.body;
                    if (mergeRequestResponse.iid) {
                      open(gitlabURL + "/" + targetProjectName + "/merge_requests/" + mergeRequestResponse.iid + (!!options.edit ? '/edit' : ''));
                    }
                    if (mergeRequestResponse.message) {
                      console.error(colors.red("Couldn't create pull request"));
                      console.log(colors.red(mergeRequestResponse.message.join()));
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}


program
  .version('0.0.1')
  .description('gitlab command line for creating merge request.')

if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(1);
}

var commandsSupported = [
  'create-merge-request',
  'browse',
  'compare',
  'open-merge-requests'
];

var command = process.argv.slice(2)[0];

if (commandsSupported.indexOf(command.trim()) == -1) {
  console.error(("Invalid command" + " " + command).red);
  program.outputHelp();
}

program
  .command('create-merge-request')
  .option('-b, --base [optional]', 'Base branch name')
  .option('-t, --target [optional]', 'Target branch name')
  .option('-m, --message [optional]', 'Title of the merge request')
  .option('-l --labels [optional]', 'Comma separated list of labels to assign while creating merge request')
  .option('-e, --edit [optional]', 'If supplied opens edit page of merge request. Opens merge request page otherwise')
  .description('Create merge request on gitlab')
  .action(function (options) {
    createMergeRequest(options);
  })

program
  .command('browse')
  .description('Open current branch page in gitlab')
  .action(function (options) {
    browse(options);
  });

program
  .command('compare')
  .option('-b, --base [optional]', 'Base branch name')
  .option('-t, --target [optional]', 'Target branch name')
  .description('Open compare page between two branches')
  .action(function (options) {
    compare(options);
  });

program
  .command('open-merge-requests')
  .description('Opens merge request page for the repo.')
  .action(function (options) {
    openMergeRequests(options);
  });

program.parse(process.argv);

module.exports = function () {

}
