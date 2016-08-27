#!/usr/bin/env node
const program = require('commander');
var gitlab = require('gitlab');
var exec = require('child_process').exec;
var editor = require('editor');
var fs = require('fs');
var open = require("open");
var Promise = require('promise');

if(!process.env.GITLAB_URL){
	console.error('Please set env name GITLAB_URL');
	console.error('Eg GITLAB_URL=http://gitlab.yourcompany.com');
	process.exit(1);
}

if(!process.env.GITLAB_TOKEN){
	console.error('Please set env variable GITLAB_TOKEN');
	console.error('Find your token at http://gitlab.yourcompany.com/profile/account');
	process.exit(1);
}

var projectDir = process.cwd();
var gitlabURL = process.env.GITLAB_URL;

var gitlab = require('gitlab')({
  url:   gitlabURL,
  token: process.env.GITLAB_TOKEN
});

function getMergeRequestTitle(title){
	var promise = new Promise(function (resolve, reject) {
	  	if(title){
	  		resolve(title);
	  	} else {
			editor('.git/PULL_REQUEST_TITLE',  function (code, sig) {
			    fs.readFile('.git/PULL_REQUEST_TITLE', 'utf8', function(err, data){
			    	title = data;
			    	resolve(title);
			    });
			});
	  	}
	});
	return promise;	
}

function getBaseBranchName(baseBranchName){
	var promise = new Promise(function (resolve, reject) {
	  	if(baseBranchName){
	  		resolve(baseBranchName);
	  	} else {
			exec('git rev-parse --abbrev-ref HEAD', {cwd : projectDir}, function(error,stdout,stderr){
				var curBranchName = stdout.replace('\n', '');
				resolve(curBranchName);
			});
	  	}
	});
	return promise;	
}

function getRemoteForBranch(branchName){
	var promise = new Promise(function (resolve, reject) {
	  	exec('git config branch.' + branchName.trim() + '.remote', {cwd : projectDir},  function(error, remote, stderr){
	  		resolve(remote.trim());
	  	});
	});
	return promise;	
}

function getURLOfRemote(remote){
	var promise = new Promise(function (resolve, reject) {
		exec('git config remote.' + remote.trim() + '.url', {cwd : projectDir}, function(err, remoteURL, stderr){
	  		resolve(remoteURL);
	  	});
	});
	return promise;	
}

function getProjectInfo(projectName){
	var promise = new Promise(function (resolve, reject) {
		gitlab.projects.show(projectName, function(project){
			resolve(project);
		});
	});
	return promise;	
}

function browse(options){
	getBaseBranchName().then(function(curBranchName){
		getRemoteForBranch(curBranchName).then(function(remote){
			if(!remote){
				console.error('Branch ' + curBranchName + " is not tracked by any remote branch.");
				console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
				console.log('Eg: `git branch --set-upstream foo upstream/foo`')
			}

			getURLOfRemote(remote).then(function(remoteURL){

				//TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.			
				var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");
				var projectName = remoteURL.match(regexParseProjectName)[1];

				open(gitlabURL + "/" + projectName + "/tree/" + curBranchName);
			});

		});
	});
}

function compare(options){

	getBaseBranchName(options.base).then(function(baseBranch){

		getRemoteForBranch(baseBranch).then(function(remote){

			if(!remote){
				console.error('Branch ' + baseBranch + " is not tracked by any remote branch.");
				console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
				console.log('Eg: `git branch --set-upstream foo upstream/foo`')
				process.exit(1);				
			}

			getURLOfRemote(remote).then(function(remoteURL){

				//TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.			
				var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");

				var projectName = remoteURL.match(regexParseProjectName)[1];
				gitlab.projects.show(projectName, function(project){
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

function openMergeRequests(options){
	getBaseBranchName(options.base).then(function(baseBranch){
		getRemoteForBranch(baseBranch).then(function(remote){

			if(!remote){
				console.error('Branch ' + baseBranch + " is not tracked by any remote branch.");
				console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
				console.log('Eg: `git branch --set-upstream foo upstream/foo`')
				process.exit(1);				
			}

			getURLOfRemote(remote).then(function(remoteURL){
				console.log(4);

				//TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.			
				var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");
				var projectName = remoteURL.match(regexParseProjectName)[1];

				open(gitlabURL + "/" + projectName + "/merge_requests");
			});
		});
	});
}

function createMergeRequest(options){

	getBaseBranchName(options.base).then(function(baseBranch){

		getRemoteForBranch(baseBranch).then(function(remote){

			if(!remote){
				console.error('Branch ' + baseBranch + " is not tracked by any remote branch.");
				console.log('Set the remote tracking by `git remote git branch --set-upstream <branch-name> <remote-name>/<branch-name>`');
				console.log('Eg: `git branch --set-upstream foo upstream/foo`')
				process.exit(1);				
			}

			getURLOfRemote(remote).then(function(remoteURL){

				//TODO : Check if remoteURL points to a gitlab repo or not. Throw error if not a gitlab repo.			
				var regexParseProjectName = new RegExp(".+[:/](.+\/.+)\.git");

				var projectName = remoteURL.match(regexParseProjectName)[1];
				gitlab.projects.show(projectName, function(project){
					var defaultBranch = project.default_branch;
					var targetBranch = options.target || defaultBranch;
					var sourceBranch = baseBranch;
					var projectId = project.id;
					var title = "";

					getMergeRequestTitle(options.message).then(function(title){
						
						gitlab.projects.merge_requests.add(projectId, sourceBranch, targetBranch, 0, title, function(mergeRequestResponse){
							if(mergeRequestResponse.iid){
								open(gitlabURL + "/" + projectName + "/merge_requests/" + mergeRequestResponse.iid);
							} else {
								console.error("Couldn't create pull request");
								console.error("Possible problems are\n" +
									"1. Alredy merge request present for the same branches.\n" + 
									"2. One of the branch is not present on remote")
							}
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
  
program
  .command('create-merge-request')
  .option('-b, --base [optional]','Base branch name')
  .option('-t, --target [optional]','Target branch name')
  .option('-m, --message [optional]', 'Title of the merge request')
  .description('Create merge request on gitlab')
  .action(function(options){
  	createMergeRequest(options);
  })

program
  .command('browse')
  .description('Open current branch page in gitlab')
  .action(function(options){
  	browse(options);
  });

program
  .command('compare')
  .option('-b, --base [optional]','Base branch name')
  .option('-t, --target [optional]','Target branch name')
  .description('Open compare page between two branches')
  .action(function(options){
  	compare(options);
  });

program
  .command('open-merge-requests')
  .description('Opens merge request page for the repo.')
  .action(function(options){
  	openMergeRequests(options);
  });

program.parse(process.argv);

module.exports = function(){

}