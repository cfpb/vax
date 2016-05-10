'use strict';

var fs = require('fs');
var path = require('path');
var request = require('request');
var semver = require('semver');
var logger = require('winston-color');
var npm = require('npm');

var fix = false;
var location, failure, manifest;

module.exports = function(program) {

  program
    .command('*')
    .description('Check your node module for security issues.')
    .action(function(loc) {
      location = loc || '.';
      fix = program.fix;
      [checkRc, checkManifest, checkShrinkwrap].forEach(function(func) {
        func(function(err, msg) {
          if (err) {
            return logger.error(err);
            process.exit(1);
          }
          return logger.info(msg);
        });
      });
    });

};

function checkRc(cb) {
  fs.readFile(path.join(location, './.npmrc'), 'utf8', function (err, data) {
    if (err) return handleIssue(1, cb);
    if (data.indexOf('save-exact') < 0) return handleIssue(2, cb);
    cb(null, 'Your `.npmrc` file looks good.');
  });
}

function checkShrinkwrap(cb) {
  fs.readFile(path.join(location, './npm-shrinkwrap.json'), 'utf8', function (err, data) {
    if (err) return handleIssue(5, cb);
    cb(null, 'It looks like you\'ve shrinkwrapped. Good job.');
  });
}

function checkManifest(cb) {
  fs.readFile(path.join(location, './package.json'), 'utf8', function (err, data) {
    var deps, failure;
    if (err || !data) return handleIssue(3, cb);
    manifest = JSON.parse(data);
    var deps = manifest.dependencies;
    for (var key in deps) {
      if (deps[key].match(/~|\^|>|<|\*/)) {
        handleIssue(4, cb, key);
        failure = true;
      }
    }
    if (fix) {
      fs.writeFile(path.join(location, './package.json'), JSON.stringify(manifest, null, 2), function(err) {
        if (err) logger.error(err);
      });
    }
    if (!failure) cb(null, 'Your `package.json` file looks good.');
  });
}

function handleIssue(type, cb, data) {
  switch (type) {
    case 1:
      if (fix) {
        request('https://raw.githubusercontent.com/cfpb/generator-cf/master/app/templates/_npmrc')
          .on('error', function(err) {
            cb(err, null)
          })
          .pipe(fs.createWriteStream(path.join(location, './.npmrc')))
        return cb(null, 'No .npmrc file found. I created one for you.');
      }
      cb('No .npmrc file found. Please create one and add `save-exact=true` to it.', null);
      break;
    case 2:
      if (fix) {
        fs.appendFile(path.join(location, './.npmrc'), '\nsave-exact=true', function(err) {
          if (err) cb(err, null);
        });
        return cb(null, 'I added `save-exact=true` to your .npmrc file.');
      }
      cb('Please add `save-exact=true` to your .npmrc file.', null);
      break;
    case 3:
      cb('No `package.json` file found. Are you sure this is a node module?', null);
      break;
    case 4:
      if (fix) {
        var newVersion = manifest.dependencies[data].replace(/^(>|~|\^|\*)|(.*(<|>|=))/, '');
        if (semver.valid(newVersion)) {
          manifest.dependencies[data] = newVersion;
          return cb(null, 'I pinned ' + data + ' to ' + newVersion + '.');
        } else {
          return cb('I tried to pin ' + data + ' but I failed. Please pin this dependency.', null);
        }
      }
      cb(data + '\'s version (' + manifest.dependencies[data] + ') has a loose range specifier in package.json. Please pin it.', null);
      break;
    case 5:
      if (fix) {
        return npm.load({loglevel: 'error'}, function(err, npm) {
          if (err) return logger.error(err);
          npm.commands.install([], function(err) {
            if (err) return logger.error(err);
            npm.commands.shrinkwrap([], true, function(err) {
              if (err) {
                return cb('Shrinkwrapping failed. :( Try manually doing it by cd\'ing to the directory and running `npm shrinkwrap`.', null);
              }
              return cb(null, 'I reinstalled and shrinkwrapped your dependencies for you.');
            });
          });
        });
      }
      cb('Please shrinkwrap your dependencies by running `npm shrinkwrap`.', null);
      break;
  }
}
