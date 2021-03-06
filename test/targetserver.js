// targetserver.js
// ------------------------------------------------------------------
//
// Tests for Developer operations.
//
// Copyright 2017-2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

/* global path, faker, describe, it, before, after */

var common = require('./common');

describe('TargetServer', function() {
  let dateVal = new Date().valueOf(),
      contrivedNameBasePrefix = 'apigee-edge-js-test-',
      contrivedNamePrefix = contrivedNameBasePrefix + dateVal;

  this.timeout(common.testTimeout);
  this.slow(common.slowThreshold);

  common.connectEdge(function(edgeOrg){

    //edgeOrg.conn.verbosity = 2;

    describe('create', function() {
      var envlist = [];
      before(function(done){
        edgeOrg.environments.get(function(e, result) {
          assert.isNull(e, "error listing: " + JSON.stringify(e));
          envlist = result;
          done();
        });
      });

      it('should create a targetserver in each environment', function() {
        const reducer = (p, env) => p.then( () =>
                                            edgeOrg.targetservers.create({
                                              environment : env,
                                              target : {
                                                name : contrivedNamePrefix + '-target1',
                                                host: "a.b.com",
                                                port: 8080,
                                                sSLInfo : { enabled : false }
                                              }
                                            })
                                            .then((result) => {
                                              assert.notExists(result.error);
                                            })
                                          );
        return envlist.reduce( reducer, Promise.resolve() );
      });

      it('should fail to create a targetserver for lack of required params', function(done) {
        let badOptions = {
              environment : envlist[0],
              target : {
                name : contrivedNamePrefix + '-target2',
                port: 8080,
                sSLInfo : { enabled : false }
              }
            };
        edgeOrg.targetservers.create(badOptions, function(e, result){
          assert.isNotNull(e, "the expected error did not occur");
          done();
        });
      });
    });

    describe('get', function() {
      var envlist = [];
      before(function(done){
        edgeOrg.environments.get(function(e, result) {
          assert.isNull(e, "error listing: " + JSON.stringify(e));
          envlist = result;
          done();
        });
      });

      it('should get a list of targetservers', () => {
        const reducer = (p, env) => p.then( () =>
                                            edgeOrg.targetservers.get({environment:env})
                                            .then((result) => {
                                              assert.notExists(result.error);
                                              assert.exists(result.length);
                                              assert.isAtLeast(result.length, 1);
                                            })
                                          );

        return envlist.reduce( reducer, Promise.resolve() );
      });

      it('should fail to get a non-existent targetserver', () => {
        const targetName = faker.random.alphaNumeric(22);
        return edgeOrg.targetservers.get({environment: envlist[0], name:targetName})
          .then ( (r) => {
            assert.fail('should not be reached');
          })
          .catch((e)  => {
            assert.exists(e);
            //console.log(JSON.stringify(e.result));
            //console.log('error:' + e);
            assert.exists(e.result.message);
            assert.equal(e.result.message, `Target server ${targetName} does not exist in environment ${envlist[0]}`);
          });
      });

    });

    describe('enable', function() {
      //edgeOrg.conn.verbosity = 2;
      var envlist = [];
      before(function(done){
        edgeOrg.environments.get(function(e, result) {
          assert.isNull(e, "error listing: " + JSON.stringify(e));
          envlist = result;
          done();
        });
      });

      it('should enable a targetserver in each env', () => {
        const reducer = (p, env) => p.then( () =>
                                            edgeOrg.targetservers.enable({environment:env, name : contrivedNamePrefix + '-target1'})
                                            .then((result) => {
                                              assert.notExists(result.error);
                                              assert.isTrue(result.isEnabled);
                                            })
                                          );

        return envlist.reduce( reducer, Promise.resolve() );
      });

      it('should fail to enable a non-existent targetserver in each env', () => {
        const fakeName = faker.random.alphaNumeric(22);
        const reducer = (p, env) => p.then( () =>
                                            edgeOrg.targetservers.enable({environment:env, name : fakeName})
                                            .then((res) => {
                                              assert.fail('should not be reached');
                                            })
                                            .catch(error => {
                                              assert.exists(error.result);
                                              assert.exists(error.result.code);
                                              assert.exists(error.result.message);
                                              assert.equal(error.result.message, `Target server ${fakeName} does not exist in environment ${env}`);
                                            })
                                          );

        return envlist.reduce( reducer, Promise.resolve() );
      });

      it('should disable a targetserver in each env', () => {
        const targetName = contrivedNamePrefix + '-target1';
        const reducer = (p, env) => p.then( () =>
                                            edgeOrg.targetservers.disable({environment:env, name : targetName})
                                            .then((result) => {
                                              assert.notExists(result.error);
                                              assert.isFalse(result.isEnabled);
                                            })
                                          );

        return envlist.reduce( reducer, Promise.resolve() );
      });

      it('should fail to disable a non-existent targetserver in each env', () => {
        const fakeName = faker.random.alphaNumeric(22);
        const reducer = (p, env) => p.then( () =>
                                            edgeOrg.targetservers.disable({environment:env, name : fakeName})
                                            .then((res) => {
                                              assert.fail('should not be reached');
                                            })
                                            .catch(error => {
                                              assert.exists(error.result);
                                              assert.exists(error.result.code);
                                              assert.exists(error.result.message);
                                              assert.equal(error.result.message, `Target server ${fakeName} does not exist in environment ${env}`);
                                            })
                                          );

        return envlist.reduce( reducer, Promise.resolve() );
      });

    });


    describe('delete', function() {
      var envlist = [];
      before(function(done){
        edgeOrg.environments.get(function(e, result) {
          assert.isNull(e, "error listing: " + JSON.stringify(e));
          envlist = result;
          done();
        });
      });

      it('should delete a targetserver', function(done) {
        let numDoneEnv = 0;
        envlist.forEach( (env) => {
          edgeOrg.targetservers.del({environment:env, name:contrivedNamePrefix + '-target1'}, function(e, result){
            assert.isNull(e, "error deleting: " + JSON.stringify(e));
            numDoneEnv++;
            if (numDoneEnv == envlist.length) {
              done();
            }
          });
        });
      });

      it('should fail to delete a targetserver because no name was specified', function(done) {
        let numDoneEnv = 0;
        envlist.forEach( (env) => {
          edgeOrg.targetservers.del({environment:env}, function(e, result){
            assert.isNotNull(e, "the expected error did not occur");
            numDoneEnv++;
            if (numDoneEnv == envlist.length) {
              done();
            }
          });
        });
      });

      it('should fail to delete a non-existent targetserver', function(done) {
        let numDoneEnv = 0;
        envlist.forEach( (env) => {
          edgeOrg.targetservers.del({environment:env, name:faker.random.alphaNumeric(22)}, function(e, result){
            assert.isNotNull(e, "the expected error did not occur");
            numDoneEnv++;
            if (numDoneEnv == envlist.length) {
              done();
            }
          });
        });
      });
    });

  });


});
