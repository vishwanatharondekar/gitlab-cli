#!/usr/bin/env node
require('dotenv').config()
var program = require('commander')
var childProcess = require('child_process')
var colors = require('colors')
var { Gitlab } = require('@gitbeaker/node')
var editor = require('editor')
var exec = childProcess.exec
var fs = require('fs')
var legacies = {}
var open = require('open')
var projectDir = process.cwd()
var Promise = require('promise')
var URL = require('url')
var options = require('./options')
var packageJson = require('./package.json')

var regexParseProjectName = /(.+:\/\/.+?\/|.+:)(.+\/[^\.]+)+(\.git)?/

var gitlab = new Gitlab(options)
gitlab.options = options

var store = (function() {
  return {
    set: function(obj) {
      Object.assign(this, obj)
    },
    get: function(key) {
      return this[key]
    },
  }
})()
var log = {
  getInstance: function(verbose) {
    return {
      log: function() {
        if (verbose) {
          console.log.apply(console, arguments)
        }
      },
    }
  },
}

var allRemotes = null
//Will be assigned value after parsing of options
var logger = null

function getMergeRequestTitle(title) {
  logger.log('\nGetting merge request title. Argument provided : ' + title)
  var promise = new Promise(function(resolve /*, reject*/) {
    if (title) {
      logger.log('Title obtained with -m option: ' + title.green)
      resolve(title)
    } else {
      exec('git rev-parse --show-toplevel', function(
        error,
        repoDir /*, stderr*/
      ) {
        var filePath = repoDir.trim() + '/.git/PULL_REQUEST_TITLE'
        exec(
          'git log -1 --pretty=%B > ' + filePath,
          function(/*error, remote, stderr*/) {
            exec('git config core.editor', function(
              error,
              gitEditor /*, stderr*/
            ) {
              editor(
                filePath,
                { editor: gitEditor.trim() || null },
                function(/*code, sig*/) {
                  fs.readFile(filePath, 'utf8', function(err, data) {
                    title = data
                    logger.log('Input obtained using editor: ' + title.green)
                    resolve(title)
                  })
                }
              )
            })
          }
        )
      })
    }
  })
  return promise
}

function getAllRemotes() {
  var promise = new Promise(function(resolve /*, reject*/) {
    if (allRemotes) {
      resolve(allRemotes)
      return
    }

    exec('git remote', { cwd: projectDir }, function(
      error,
      allRemotes /*, stderr*/
    ) {
      if (error) {
        logger.log(colors.red('Error occurred :\n'), colors.red(error))
        process.exit(1)
      }

      allRemotes = allRemotes.split('\n')
      resolve(allRemotes)
    })
  })
  return promise
}

function parseBranchRemoteInfo(branchName) {
  var promise = new Promise(function(resolve /*, reject*/) {
    if (branchName.indexOf('/') != -1) {
      getAllRemotes().then(function(allRemotes) {
        var splits = branchName.split('/')
        var maybeRemote = splits[0].trim()
        var remoteName = null
        if (allRemotes.indexOf(maybeRemote) != -1) {
          branchName = splits.slice(1).join('/')
          remoteName = maybeRemote
        }
        logger.log('Branch name obtained :', branchName.green)
        resolve({
          branch: branchName,
          remote: remoteName,
        })
      })
    } else {
      resolve({
        branch: branchName,
      })
    }
  })
  return promise
}

function getBaseBranchName(baseBranchName) {
  logger.log('\nGetting base branch name : ')
  var promise = new Promise(function(resolve /*, reject*/) {
    if (baseBranchName) {
      logger.log('Argument provided : ' + baseBranchName)

      parseBranchRemoteInfo(baseBranchName).then(function(branchRemoteInfo) {
        logger.log('Base branch name obtained :', branchRemoteInfo.branch.green)
        resolve(branchRemoteInfo.branch)
      })
    } else {
      logger.log('Executing git rev-parse --abbrev-ref HEAD')

      exec('git rev-parse --abbrev-ref HEAD', { cwd: projectDir }, function(
        error,
        stdout /*, stderr*/
      ) {
        if (error) {
          logger.log(colors.red('Error occured :\n'), colors.red(error))
          process.exit(1)
        }
        var curBranchName = stdout.replace('\n', '')
        logger.log('Base branch name obtained :', curBranchName.green)
        resolve(curBranchName)
      })
    }
  })
  return promise
}

function getTargetBranchName(branchName) {
  var promise = new Promise(function(resolve /*, reject*/) {
    parseBranchRemoteInfo(branchName).then(function(branchRemoteInfo) {
      logger.log('Remote branch name obtained :', branchRemoteInfo.branch.green)
      resolve(branchRemoteInfo.branch)
    })
  })
  return promise
}

function getRemoteForBranch(branchName) {
  logger.log('\nGetting remote of branch :', branchName)

  var promise = new Promise(function(resolve /*, reject*/) {
    parseBranchRemoteInfo(branchName).then(function(branchRemoteInfo) {
      if (branchRemoteInfo.remote) {
        //Remote info supplied in the branch name
        logger.log('Remote obtained : ' + branchRemoteInfo.remote.green)
        resolve(branchRemoteInfo.remote)
      } else {
        //Remote info is not supplied. Get it from remote set
        logger.log(
          'Executing git config branch.' + branchName.trim() + '.remote'
        )
        exec(
          'git config branch.' + branchName.trim() + '.remote',
          { cwd: projectDir },
          function(error, remote /*, stderr*/) {
            if (error) {
              console.error(
                colors.red(
                  'Error occured while getting remote of the branch: ',
                  branchName,
                  '\n'
                )
              )
              console.log(
                '\n\nSet the remote tracking by `git branch --set-upstream-to=origin/' +
                  branchName +
                  '`. Assuming origin is your remote.'
              )
              console.log(
                'Look at https://git-scm.com/docs/git-branch#Documentation/git-branch.txt---set-upstream for more details.'
              )
              console.log(
                '\n\nBonus tip : You can avoid doing this each time by adding -u option while pushing to your origin.'
              )
              console.log('Eg: `git push origin ' + branchName + ' -u`')
              process.exit(1)
            }
            logger.log('Remote obtained : ' + remote.green)
            resolve(remote.trim())
          }
        )
      }
    })
  })
  return promise
}

function getURLOfRemote(remote) {
  logger.log('\nGetting URL of remote : ' + remote)
  var promise = new Promise(function(resolve /*, reject*/) {
    logger.log('Executing ', 'git config remote.' + remote.trim() + '.url')
    exec(
      'git config remote.' + remote.trim() + '.url',
      { cwd: projectDir },
      function(error, remoteURL /*, stderr*/) {
        if (error) {
          console.error(colors.red('Error occured :\n'), colors.red(error))

          process.exit(1)
        }
        logger.log('URL of remote obtained : ' + remoteURL.green)
        resolve(remoteURL.trim())
      }
    )
  })
  return promise
}

function browse(options) {
  logger = log.getInstance(options.verbose)
  getBaseBranchName().then(function(curBranchName) {
    getRemoteForBranch(curBranchName).then(function(remote) {
      if (!remote) {
        console.error(
          colors.red(
            'Branch ' + curBranchName + ' is not tracked by any remote branch.'
          )
        )
        console.log(
          'Set the remote tracking by `git branch --set-upstream <branch-name> <remote-name>/<branch-name>`'
        )
        console.log('Eg: `git branch --set-upstream foo upstream/foo`')
      }

      getURLOfRemote(remote).then(function(remoteURL) {
        var projectName = remoteURL.match(regexParseProjectName)[2]
        var page = options.page || ''
        if (page === '') {
          open(
            gitlab.options.host + '/' + projectName + '/tree/' + curBranchName
          )
        } else {
          open(gitlab.options.host + '/' + projectName + '/' + page)
        }
      })
    })
  })
}

function compare(options) {
  logger = log.getInstance(options.verbose)

  getBaseBranchName(options.base).then(function(baseBranch) {
    getRemoteForBranch(baseBranch).then(function(remote) {
      if (!remote) {
        console.error(
          colors.red(
            'Branch ' + baseBranch + ' is not tracked by any remote branch.'
          )
        )
        console.log(
          'Set the remote tracking by `git branch --set-upstream <branch-name> <remote-name>/<branch-name>`'
        )
        console.log('Eg: `git branch --set-upstream foo upstream/foo`')
        process.exit(1)
      }

      getURLOfRemote(remote).then(function(remoteURL) {
        var projectName = remoteURL.match(regexParseProjectName)[2]
        gitlab.Projects.search(projectName, {
          search_namespaces: true,
          membership: true,
        })
          .then(function(project) {
            project = project[0]
            var defaultBranch = project.default_branch
            var targetBranch = options.target || defaultBranch
            var sourceBranch = baseBranch
            open(
              gitlab.options.host +
                '/' +
                projectName +
                '/compare/' +
                targetBranch +
                '...' +
                sourceBranch
            )
          })
          .catch(function(err) {
            console.log('Project info fetch failed : ' + err)
          })
      })
    })
  })
}

function getRemote(options) {
  logger.log('\nGetting remote for options provided : ' + options.remote)
  var promise = new Promise(function(resolve /*, reject*/) {
    if (options.remote) {
      resolve(options.remote)
      return
    }

    getBaseBranchName(options.base).then(function(baseBranch) {
      getRemoteForBranch(baseBranch).then(function(remote) {
        resolve(remote, baseBranch)
      })
    })
  })
  return promise
}

function getUser(query) {
  var promise = new Promise(function(resolve /*, reject*/) {
    if (typeof query !== 'string') {
      resolve(null)
      return
    }

    logger.log('\nGetting user matching : ' + query)

    gitlab.Users.search(query)
      .then(function(userInfo) {
        if (userInfo instanceof Array && userInfo.length > 0) {
          var user = userInfo[0]
          resolve(user)
        } else {
          console.error(
            colors.yellow(
              'User matching "' +
                query +
                '" was not found. Please check input and try again.'
            )
          )
          process.exit(1)
        }
      })
      .catch(function(err) {
        console.log('User search fetch failed : ' + err)
      })
  })

  return promise
}

function openMergeRequests(options) {
  logger = log.getInstance(options.verbose)

  getRemote(options).then(function(remote, baseBranch) {
    if (!remote) {
      console.error(
        colors.red(
          'Branch ' + baseBranch + ' is not tracked by any remote branch.'
        )
      )
      console.log(
        'Set the remote tracking by `git branch --set-upstream <branch-name> <remote-name>/<branch-name>`'
      )
      console.log('Eg: `git branch --set-upstream foo upstream/foo`')
      process.exit(1)
    }

    getURLOfRemote(remote).then(function(remoteURL) {
      getUser(options.assignee).then(function(assignee) {
        var projectName = remoteURL.match(regexParseProjectName)[2]

        var query = '?'

        if (options.state) {
          query += 'state=' + options.state + '&'
        }

        if (assignee) {
          query += 'assignee_id=' + assignee.id + '&'
        }

        open(
          gitlab.options.host +
            '/' +
            projectName +
            '/merge_requests' +
            query.slice(0, -1)
        )
      })
    })
  })
}

function createMergeRequest(options) {
  logger = log.getInstance(options.verbose)

  if (options.verbose) {
    logger.log(
      'Verbose option used. Detailed logging information will be emitted.'.green
    )
  }

  logger.log('\n\n\nGetting base branch information'.blue)
  getBaseBranchName(options.base)
    .then(function(sourceBranch) {
      store.set({ sourceBranch: sourceBranch })
      return getRemoteForBranch(options.base || store.get('sourceBranch'))
    })
    .then(function(remote) {
      store.set({ sourceRemote: remote })
      return getURLOfRemote(remote)
    })
    .then(function(remoteURL) {
      var gitlabHost = URL.parse(gitlab.options.host).host

      logger.log('\ngitlab host obtained : ' + gitlabHost.green)

      var match = remoteURL.match(regexParseProjectName)
      if (match) {
        var projectName = match[2]
      } else {
        console.error(
          colors.red(
            'The remote at which ' +
              store.get('sourceBranch') +
              " is tracked doesn't match the expected format."
          )
        )
        console.log(
          'Please contact developer if this is a valid gitlab repository.'
        )
        process.exit(1)
      }
      logger.log('\nProject name derived from host :', projectName)
      logger.log('\nGetting gitlab project info for :', projectName)
      store.set({ sourceRemoteURL: remoteURL })
      return gitlab.Projects.search(projectName, {
        search_namespaces: true,
        membership: true,
      })
    })
    .then(function(project) {
      project = project[0]
      logger.log('Base project info obtained :', JSON.stringify(project).green)

      var defaultBranch = project.default_branch
      var targetBranch = options.target || defaultBranch

      logger.log('\n\n\nGetting target branch information'.blue)

      store.set({ sourceProject: project })
      return getTargetBranchName(options.target || targetBranch)
    })
    .then(function(targetBranch) {
      store.set({ targetBranch: targetBranch })
      return getRemoteForBranch(options.target || targetBranch)
    })
    .then(function(targetRemote) {
      store.set({ targetRemote: targetRemote })
      return getURLOfRemote(targetRemote)
    })
    .then(function(targetRemoteUrl) {
      var targetMatch = targetRemoteUrl.match(regexParseProjectName)
      if (targetMatch) {
        var targetProjectName = targetMatch[2]
      } else {
        console.error(
          colors.red(
            'The remote at which ' +
              targetBranch +
              " is tracked doesn't match the expected format."
          )
        )
        console.log(
          'Please contact developer if this is a valid gitlab repository.'
        )
        process.exit(1)
      }

      logger.log('Getting target project information')
      store.set({ targetRemoteUrl: targetRemoteUrl })
      return gitlab.Projects.search(targetProjectName, {
        search_namespaces: true,
        membership: true,
      })
    })
    .then(function(targetProject) {
      targetProject = targetProject[0]
      logger.log(
        'Target project info obtained :',
        JSON.stringify(targetProject).green
      )

      var targetProjectId = targetProject.id
      var sourceBranch = store.get('sourceBranch')
      var targetBranch = store.get('targetBranch')
      var projectId = store.get('sourceProject').id

      if (sourceBranch == targetBranch && projectId == targetProjectId) {
        console.error(colors.red('\nCan not create this merge request'))
        console.log(
          colors.red(
            'You can not use same project/branch for source and target'
          )
        )
        process.exit(1)
      }
      store.set({ targetProject: targetProject })
      return getUser(options.assignee)
    })
    .then(function(assignee) {
      store.set({ assignee: assignee })
      return getMergeRequestTitle(options.message)
    })
    .then(function(userMessage) {
      var title = userMessage.split('\n')[0]
      var description =
        options.description ||
        userMessage
          .split('\n')
          .slice(2)
          .join('    \n')

      logger.log('Merge request title : ' + title.green)
      if (description)
        logger.log('Merge request description : ' + description.green)
      logger.log('\n\nCreating merge request'.blue)

      var sourceBranch = store.get('sourceBranch')
      var targetBranch = store.get('targetBranch')
      var sourceProject = store.get('sourceProject')
      var sourceProjectId = sourceProject.id
      var targetProject = store.get('targetProject')
      var targetProjectId = targetProject.id
      var labels = options.labels || ''
      var remove_source_branch = options.remove_source_branch || false
      var squash = options.squash || false
      var assignee = store.get('assignee')

      return gitlab.MergeRequests.create(
        sourceProjectId,
        sourceBranch,
        targetBranch,
        title,
        {
          description: description,
          labels: labels,
          assignee_id: assignee && assignee.id,
          target_project_id: targetProjectId,
          remove_source_branch: remove_source_branch,
          squash: squash,
        }
      )
      store.set({ userMessage: userMessage })
    })
    .then(function(mergeRequestResponse) {
      logger.log('Merge request response: \n\n', mergeRequestResponse)

      if (mergeRequestResponse.iid) {
        var url = mergeRequestResponse.web_url

        if (!url) {
          url =
            gitlab.options.host +
            '/' +
            targetProjectName +
            '/merge_requests/' +
            mergeRequestResponse.iid
        }

        if (options.edit) {
          url += '/edit'
        }

        if (options.open) {
          open(url)
        } else {
          console.log(url)
        }
      }
    })
    .catch(function(err) {
      if (err.message) {
        console.error(colors.red("Couldn't create merge request"))
        console.log(colors.red(err.message))
      } else if (err instanceof Array) {
        console.error(colors.red("Couldn't create merge request"))
        console.log(colors.red(err.join()))
      }
    })
}

program.description('gitlab command line utility').version(packageJson.version)

program.Command.prototype.legacy = function(alias) {
  legacies[alias] = this._name
  return this
}

program
  .command('browse')
  .option(
    '-v, --verbose [optional]',
    'Detailed logging emitted on console for debug purpose'
  )
  .option(
    '-p, --page [optional]',
    'Page name. e.g: issues, boards, merge_requests, pipelines, etc.'
  )
  .description('Open current branch page in gitlab')
  .action(function(options) {
    browse(options)
  })

program
  .command('compare')
  .option('-b, --base [optional]', 'Base branch name')
  .option('-t, --target [optional]', 'Target branch name')
  .option(
    '-v, --verbose [optional]',
    'Detailed logging emitted on console for debug purpose'
  )
  .description('Open compare page between two branches')
  .action(function(options) {
    compare(options)
  })

program
  .command('merge-request')
  .alias('mr')
  .legacy('create-merge-request')
  .option('-b, --base [optional]', 'Base branch name')
  .option('-t, --target [optional]', 'Target branch name')
  .option('-m, --message [optional]', 'Title of the merge request')
  .option('-d, --description [optional]', 'Description for the merge request')
  .option('-a, --assignee [optional]', 'User to assign merge request to')
  .option(
    '-l, --labels [optional]',
    'Comma separated list of labels to assign while creating merge request'
  )
  .option(
    '-r, --remove_source_branch [optional]',
    'Flag indicating if a merge request should remove the source branch when merging'
  )
  .option(
    '-s, --squash [optional]',
    'Squash commits into a single commit when merging'
  )
  .option(
    '-e, --edit [optional]',
    'If supplied opens edit page of merge request. Prints the merge request URL otherwise'
  )
  .option(
    '-o, --open [optional]',
    'If supplied open the page of the merge request. Prints the merge request URL otherwise'
  )
  .option(
    '-p, --print [deprecated]',
    'Doesn`t do anything. Kept here for backward compatibility. Default is print.'
  )
  .option(
    '-v, --verbose [optional]',
    'Detailed logging emitted on console for debug purpose'
  )
  .description('Create merge request on gitlab')
  .action(function(options) {
    createMergeRequest(options)
  })

program
  .command('merge-requests')
  .alias('mrs')
  .legacy('open-merge-requests')
  .option(
    '-v, --verbose [optional]',
    'Detailed logging emitted on console for debug purpose'
  )
  .option('-r, --remote [optional]', 'If provided this will be used as remote')
  .option(
    '-a, --assignee [optional]',
    'If provided, merge requests assigned to only this user will be shown'
  )
  .option(
    '-s, --state [optional]',
    'If provide merge requests with state provided will be shown'
  )
  .description('Opens merge requests page for the repo')
  .action(function(options) {
    openMergeRequests(options)
  })

program.on('command:*', function() {
  console.error(('Invalid command ' + program.args[0]).red)
  program.outputHelp()
})

if (legacies[process.argv[2]]) process.argv[2] = legacies[process.argv[2]]

program.parse(process.argv)

if (program.args.length < 1) {
  program.outputHelp()
}

module.exports = function() {}
