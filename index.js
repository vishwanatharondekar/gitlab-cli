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

var log = {
  getInstance : function(verbose){
    return {
      log : function(debugInfo){
        if(verbose){
          console.log.apply(console, arguments);
        }
      }
    }
  }
}

var allRemotes = null;

//Will be assigned value after parsing of options
var logger = null;


function getMergeRequestTitle(title){
  logger.log('\nGetting merge request title. Argument provided : ', title);
  var promise = new Promise(function (resolve, reject) {
      if(title){
        logger.log('Title obtained with -m option: ', title.green);
        resolve(title);
      } else {
      exec('git log -1 --pretty=%B > .git/PULL_REQUEST_TITLE',  function(error, remote, stderr){
        editor('.git/PULL_REQUEST_TITLE',  function (code, sig) {
          fs.readFile('.git/PULL_REQUEST_TITLE', 'utf8', function(err, data){
            title = data;
            logger.log('Input obtained using editor: ', title.green);
            resolve(title);
          });
        });
      });
    }
  });
  return promise;
}

function getAllRemotes(){
  var promise = new Promise(function (resolve, reject) {
    if(allRemotes){
      resolve(allRemotes);
      return;
    }

    exec('git remote', { cwd: projectDir }, function (error, allRemotes, stderr) {
      if(error){
        logger.log(colors.red('Error occured :\n') , colors.red(error));
        process.exit(1);;
      }

      allRemotes = allRemotes.split('\n');
      resolve(allRemotes);
    });
  });
  return promise;
}

function parseBranchRemoteInfo(branchName){
  var promise = new Promise(function (resolve, reject) {

    if(branchName.indexOf('/')!=-1){
      getAllRemotes().then(function(allRemotes){
        var splits = branchName.split('/');
        var maybeRemote = splits[0].trim();
        var remoteName = null;
        if(allRemotes.indexOf(maybeRemote) != -1){
          branchName = splits.slice(1).join("/");
          remoteName = maybeRemote;
        }
        logger.log('Branch name obtained :', branchName.green);
        resolve({
          branch : branchName,
          remote : remoteName
        })
      });
    } else {
      resolve({
        branch : branchName,
      });
    }
  });
  return promise;
}


function getBaseBranchName(baseBranchName) {
  logger.log('\nGetting base branch name : ');
  var promise = new Promise(function (resolve, reject) {
    if (baseBranchName) {
      logger.log('Argument provided : ' + baseBranchName);

      parseBranchRemoteInfo(baseBranchName).then(function(branchRemoteInfo){
        logger.log('Base branch name obtained :', branchRemoteInfo.branch.green);
        resolve(branchRemoteInfo.branch);
      });
    } else {
      logger.log('Executing git rev-parse --abbrev-ref HEAD');

      exec('git rev-parse --abbrev-ref HEAD', { cwd: projectDir }, function (error, stdout, stderr) {
        if(error){
          logger.log(colors.red('Error occured :\n') , colors.red(error));
          process.exit(1);;
        }
        curBranchName = stdout.replace('\n', '');
        logger.log('Base branch name obtained :', curBranchName.green);
        resolve(curBranchName);
      });
    }
  });
  return promise;
}

function getTargetBranchName(branchName){
  var promise = new Promise(function (resolve, reject) {
    parseBranchRemoteInfo(branchName).then(function(branchRemoteInfo){
      logger.log('Remote branch name obtained :', branchRemoteInfo.branch.green);
      resolve(branchRemoteInfo.branch);
    });
  });
  return promise;
}

function getRemoteForBranch(branchName) {
  logger.log('\nGetting remote of branch  :', branchName);


  var promise = new Promise(function (resolve, reject) {

    parseBranchRemoteInfo(branchName).then(function(branchRemoteInfo){
      if(branchRemoteInfo.remote){
        //Remote info supplied in the branch name
        logger.log('Remote obtained : ', branchRemoteInfo.remote.green);
        resolve(branchRemoteInfo.remote)
      } else {
        //Remote info is not supplied. Get it from remote set
        logger.log('Executing git config branch.' + branchName.trim() + '.remote');
        exec('git config branch.' + branchName.trim() + '.remote', { cwd: projectDir }, function (error, remote, stderr) {
          if(error){
            console.error(colors.red('Error occured :\n') , colors.red(error));
            process.exit(1);
          }
          logger.log('Remote obtained : ', remote.green);
          resolve(remote.trim());
        });
      }
    });
  });
  return promise;
}

function getURLOfRemote(remote) {
  logger.log('\nGetting URL of remote : ', remote);
  var promise = new Promise(function (resolve, reject) {
    logger.log('Executing ', 'git config remote.' + remote.trim() + '.url');
    exec('git config remote.' + remote.trim() + '.url', { cwd: projectDir }, function (error, remoteURL, stderr) {
      if(error){
          console.error(colors.red('Error occured :\n') , colors.red(error));
          process.exit(1);
      }
      logger.log('URL of remote obtained : ', remoteURL.green)
      resolve(remoteURL);
    });
  });
  return promise;
}

function getProjectInfo(projectName) {
  logger.log('\nGetting project info for project : ', projectName);
  var promise = new Promise(function (resolve, reject) {
    gitlab.projects.show(projectName, function (project) {
      logger.log('Project info obtained : ', project);
      resolve(project);
    });
  });
  return promise;
}

function browse(options) {
  logger = log.getInstance(options.verbose);

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
  logger = log.getInstance(options.verbose);

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

function getRemote(options){
  logger.log('\nGetting remote for options provided : ', options.remote);
  var promise = new Promise(function (resolve, reject) {
    if(options.remote){
      resolve(options.remote)
      return;
    }

    getBaseBranchName(options.base).then(function (baseBranch) {
      getRemoteForBranch(baseBranch).then(function (remote) {
        resolve(remote)
      })
    })
  });
  return promise;
}

function openMergeRequests(options) {
  logger = log.getInstance(options.verbose);
  getRemote(options).then(function(remote){

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
  })
}

function createMergeRequest(options) {

  logger = log.getInstance(options.verbose);
  if(options.verbose){
    logger.log('verbose option used. Detailed logging information will be emitted.'.green);
  }

  logger.log('\n\n\nGetting base branch information'.blue);
  getBaseBranchName(options.base).then(function (baseBranch) {

    getRemoteForBranch(options.base || baseBranch).then(function (remote) {

      if (!remote) {
        console.error(colors.red('Branch ' + baseBranch + " is not tracked by any remote branch."));
        console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
        console.log('Eg: `git branch --set-upstream foo upstream/foo`');
        process.exit(1);
      }

      getURLOfRemote(remote).then(function (remoteURL) {

        var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");
        var gitlabHost = URL.parse(gitlabURL).host;

        logger.log('\ngitlab host obtained : ', gitlabHost.green);

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

        logger.log('\nProject name derived from host :', projectName);

        logger.log('\nGetting gitlab project info for :', projectName);
        gitlab.projects.show(projectName, function (project) {
          logger.log('Base project info obtained :', JSON.stringify(project).green);




          var defaultBranch = project.default_branch;
          var targetBranch = options.target || defaultBranch;
          var sourceBranch = baseBranch;
          var projectId = project.id;
          var labels = options.labels || "";
          var title = "";

          logger.log('\n\n\nGetting target branch information'.blue);

          getTargetBranchName(options.target || targetBranch).then(function(targetBranch){
            getRemoteForBranch(options.target || targetBranch).then(function (targetRemote) {
              getURLOfRemote(targetRemote).then(function (targetRemoteUrl) {
                var targetMatch = targetRemoteUrl.match(regexParseProjectName);
                if (targetMatch) {
                  var targetProjectName = targetMatch[1];
                } else {
                  console.error(colors.red('Remote at which ' + targetBranch + " is tracked, It's URL doesn't seem to end with .git . It is assumed that your remote URL will end with .git in this utility. "));
                  console.log('Please contact developer if this is a valid gitlab repository.');
                  process.exit(1);
                }

                logger.log('Getting target project information');
                gitlab.projects.show(targetProjectName, function (targetProject) {
                  logger.log('Target project info obtained :', JSON.stringify(targetProject).green);
                  var targetProjectId = targetProject.id;

                  if(sourceBranch==targetBranch && projectId==targetProjectId){
                    console.error(colors.red("\nCan not create this merge request"));
                    console.log(colors.red("You can not use same project/branch for source and target"));
                    process.exit(1);
                  }

                  getMergeRequestTitle(options.message).then(function (userMessage) {

                    var title = userMessage.split("\n")[0];
                    var description = userMessage.split("\n").slice(2).join("    \n");

                    logger.log('Merge request title : ', title.green);
                    if(description){
                      logger.log('Merge request description : ', description.green);
                    }

                    logger.log('\n\nCreating merge request'.blue)

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
                      logger.log('Merge request response : \n\n', mergeRequestResponse);

                      if (mergeRequestResponse.iid) {
                        open(gitlabURL + "/" + targetProjectName + "/merge_requests/" + mergeRequestResponse.iid + (!!options.edit ? '/edit' : ''));
                        return;
                      }
                      if (mergeRequestResponse.message) {
                        console.error(colors.red("Couldn't create merge request"));
                        console.log(colors.red(mergeRequestResponse.message.join()));
                      }
                      if(mergeRequestResponse instanceof Array){
                        console.error(colors.red("Couldn't create merge request"));
                        console.log(colors.red(mergeRequestResponse.join()));
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
  .option('-v, --verbose [optional]', 'Detailed logging emitted on console for debug purpose')
  .description('Create merge request on gitlab')
  .action(function (options) {
    createMergeRequest(options);
  })

program
  .command('browse')
  .option('-v, --verbose [optional]', 'Detailed logging emitted on console for debug purpose')
  .description('Open current branch page in gitlab')
  .action(function (options) {
    browse(options);
  });

program
  .command('compare')
  .option('-b, --base [optional]', 'Base branch name')
  .option('-t, --target [optional]', 'Target branch name')
  .option('-v, --verbose [optional]', 'Detailed logging emitted on console for debug purpose')
  .description('Open compare page between two branches')
  .action(function (options) {
    compare(options);
  });

program
  .command('open-merge-requests')
  .option('-v, --verbose [optional]', 'Detailed logging emitted on console for debug purpose')
  .option('-r, --remote [optional]', 'If provided this will be used as remote')
  .description('Opens merge request page for the repo.')
  .action(function (options) {
    openMergeRequests(options);
  });

program.parse(process.argv);

module.exports = function () {

}
