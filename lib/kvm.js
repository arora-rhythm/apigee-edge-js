// kvm.js
// ------------------------------------------------------------------
// Copyright 2018 Google LLC.
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

(function (){
  'use strict';
  const utility = require('./utility.js'),
        common  = require('./common.js'),
        request = require('request'),
        urljoin = require('url-join'),
        sprintf = require('sprintf-js').sprintf;

  function Kvm(conn) {this.conn = conn;}

  function resolveKvmPath(conn, options) {
    if (options && options.env) {
      return urljoin(conn.urlBase, 'e', options.env, 'keyvaluemaps');
    }
    if (options && options.proxy) {
      return urljoin(conn.urlBase, 'apis', options.proxy, 'keyvaluemaps');
    }
    return urljoin(conn.urlBase, 'keyvaluemaps');
  }

  function putKvm0(conn, options, cb) {
    common.mergeRequestOptions(conn, function(requestOptions) {
      requestOptions.url = resolveKvmPath(conn, options);

      if (conn.orgProperties['features.isCpsEnabled']) {
        if (!options.key || !options.value) {
          throw new Error("missing key or value");
        }
        requestOptions.url = urljoin(requestOptions.url, options.kvm, 'entries', options.key);
        if (conn.verbosity>0) {
          utility.logWrite(sprintf('GET %s', requestOptions.url));
        }
        request.get(requestOptions, function(error, response, body) {
          if (error) {
            utility.logWrite(error);
            return cb(error, body);
          }
          requestOptions.url = resolveKvmPath(conn, options);
          requestOptions.url = urljoin(requestOptions.url, options.kvm, 'entries');

          if (response.statusCode == 200) {
            // Update is required if the key already exists.
            if (conn.verbosity>0) {
              utility.logWrite('KVM entry update');
            }
            requestOptions.url = urljoin(requestOptions.url, options.key);
          }
          else if (response.statusCode == 404) {
            if (conn.verbosity>0) {
              utility.logWrite('KVM entry create');
            }
          }

          if ((response.statusCode == 200) || (response.statusCode == 404)) {
            //
            // POST :mgmtserver/v1/o/:orgname/e/:env/keyvaluemaps/:mapname/entries/key1
            // Authorization: :edge-auth
            // content-type: application/json
            //
            // {
            //    "name" : "key1",
            //    "value" : "value_one_updated"
            // }
            requestOptions.headers['content-type'] = 'application/json';
            requestOptions.body = JSON.stringify({ name: options.key, value : options.value });
            if (conn.verbosity>0) {
              utility.logWrite(sprintf('POST %s', requestOptions.url));
            }
            request.post(requestOptions, common.callback(conn, [200, 201], cb));
          }
          else {
            if (conn.verbosity>0) {
              utility.logWrite(body);
            }
            cb({error: 'bad status', statusCode: response.statusCode });
          }
        });
      }
      else {
        if (!options.entries && (!options.key || !options.value)) {
          throw new Error("missing entries or key/value");
        }
        // for non-CPS KVM, use a different model to add/update an entry.
        //
        // POST :mgmtserver/v1/o/:orgname/e/:env/keyvaluemaps/:mapname
        // Authorization: :edge-auth
        // content-type: application/json
        //
        // {
        //    "entry": [ {"name" : "key1", "value" : "value_one_updated" } ],
        //    "name" : "mapname"
        // }
        requestOptions.url = urljoin(requestOptions.url, options.kvm);
        requestOptions.headers['content-type'] = 'application/json';
        var entry = options.entries ?
          common.hashToArrayOfKeyValuePairs(options.entries) :
          [{ name: options.key, value : options.value }] ;

        requestOptions.body = JSON.stringify({ name: options.kvm, entry: entry });
        if (conn.verbosity>0) {
          utility.logWrite(sprintf('POST %s', requestOptions.url));
        }
        request.post(requestOptions, common.callback(conn, [200, 201], cb));
      }
    });
  }


  Kvm.prototype.get = function(options, cb) {
    var conn = this.conn;
    common.mergeRequestOptions(conn, function(requestOptions) {
      requestOptions.url = resolveKvmPath(conn, options);
      if (conn.verbosity>0) {
        utility.logWrite(sprintf('GET %s', requestOptions.url));
      }
      request.get(requestOptions, common.callback(conn, [200], cb));
    });
  };

  Kvm.prototype.create = function(options, cb) {
    // POST :mgmtserver/v1/o/:orgname/e/:env/keyvaluemaps
    // Authorization: :edge-auth
    // Content-type: application/json
    //
    // {
    //  "encrypted" : "false",
    //  "name" : ":mapname",
    //   "entry" : [   {
    //     "name" : "key1",
    //     "value" : "value_one"
    //     }, ...
    //   ]
    // }
    var conn = this.conn;
    if (conn.verbosity>0) {
      utility.logWrite(sprintf('Create KVM %s', options.name));
    }

    common.mergeRequestOptions(conn, function(requestOptions) {
      requestOptions.url = resolveKvmPath(conn, options);
      requestOptions.headers['content-type'] = 'application/json';
      requestOptions.body = JSON.stringify({
        encrypted : options.encrypted ? "true" : "false",
        name : options.name,
        entry : options.entries ? common.hashToArrayOfKeyValuePairs(options.entries) : []
      });
      if (conn.verbosity>0) {
        utility.logWrite(sprintf('POST %s', requestOptions.url));
      }
      request.post(requestOptions, common.callback(conn, [201], cb));
    });
  };

  Kvm.prototype.put = function(options, cb) {
    var conn = this.conn;
    if ( ! conn.orgProperties) {
      conn.org.getProperties(function(e, result) {
        if (e) { return cb(e, result); }
        putKvm0(conn, options, cb);
      });
    }
    else {
      return putKvm0(conn, options, cb);
    }
  };

  Kvm.prototype.del = function(options, cb) {
    // eg,
    // DELETE :mgmtserver/v1/o/:orgname/e/:env/keyvaluemaps/:kvmname
    // Authorization: :edge-auth
    var conn = this.conn;
    var name = options.name || options.kvm;
    if ( ! name ) {
      return cb({error:"missing KVM name"});
    }
    common.mergeRequestOptions(conn, function(requestOptions) {
      requestOptions.url = resolveKvmPath(conn, options);
      requestOptions.url = urljoin(requestOptions.url, name);
      if (conn.verbosity>0) {
        utility.logWrite(sprintf('DELETE %s', requestOptions.url));
      }
      request.del(requestOptions, common.callback(conn, [200], cb));
    });
  };

  module.exports = Kvm;

}());