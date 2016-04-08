/* global describe, it */
'use strict';

var assert = require('assert');
var exec = require('child_process').exec;
var path = require('path');

describe('vax bin', function () {
  var cmd = 'node ' + path.join(__dirname, '../bin/vax') + ' ';
  console.log(cmd);

  it('--help should run without errors', function (done) {
    exec(cmd + '--help', function (error, stdout, stderr) {
      assert(!error);
      done();
    });
  });

  it('--version should run without errors', function (done) {
    exec(cmd + '--version', function (error, stdout, stderr) {
      assert(!error);
      done();
    });
  });

});
