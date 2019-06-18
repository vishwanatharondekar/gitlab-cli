var childProcess = require('child_process');
var gitUrlParse = require('git-url-parse');
var readlineSync = require('readline-sync');
var exec = childProcess.exec;
var execSync = childProcess.execSync;
var projectDir = process.cwd();

var git = {
    config: {
      get: function (key) {
        return execSync('git config --get ' + key + ' || true', { cwd: projectDir }).toString().trim();
      },
      set: function (key, value) {
        execSync('git config --add ' + key + ' ' + value, { cwd: projectDir });
      },
    }
  };
  
  var options = (function () {
    var options = {
      url: git.config.get('gitlab.url') || process.env.GITLAB_URL,
      token: git.config.get('gitlab.token') || process.env.GITLAB_TOKEN,
    };
  
    if (!options.url) {
      var defaultInput = (function () {
        var url = git.config.get('remote.origin.url');
        if (!url || url.indexOf('bitbucket') !== -1 || url.indexOf('github') !== -1) {
          url = 'https://gitlab.com';
        }
        return 'https://' + gitUrlParse(url).resource;
      })();
      var urlQuestion = ('Enter GitLab URL (' + defaultInput + '): ').yellow;
      while (!options.url) {
        options.url = readlineSync.question(urlQuestion, { defaultInput: defaultInput });
        urlQuestion = 'Invalid URL (try again): '.red;
      }
      git.config.set('gitlab.url', options.url);
    }
  
    if (!options.token) {
      var url = options.url + '/profile/personal_access_tokens';
      console.log('A personal access token is needed to use the GitLab API\n' + url.grey);
      var tokenQuestion = 'Enter personal access token: '.yellow;
      while (!options.token) {
        options.token = readlineSync.question(tokenQuestion);
        tokenQuestion = 'Invalid token (try again): '.red;
      }
      git.config.set('gitlab.token', options.token);
    }

    options.rejectUnauthorized = false;
  
    return options;
  })();

 module.exports = options