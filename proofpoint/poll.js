const util = require('./util.js');
const async = require('async');

/*
<div class="form-row">
        <input type="checkbox" id="node-input-includeUrls" style="display: inline-block; width: auto; vertical-align: top;">
        <label for="node-input-includeUrls" style="width: 70%;"><span data-i18n="node-red:httpin.basicauth">Use basic authentication</span></label>
    </div>
 */

module.exports = function(RED) {

    function Poll(config) {
        RED.nodes.createNode(this, config);
        this.persistenceFile = config.persistenceFile;
        var node = this;
        const principal = this.credentials.principal;
        const secret = this.credentials.secret;
        //const persistenceFile = config.persistenceFile;

        node.on('input', function(msg) {
            async.auto({
                lastTimestamp: function(callback) {
                    if (msg.payload.lastTimestamp) {
                        return callback(null, msg.payload.lastTimestamp);
                    }
                    util.retrieveLastTimeStamp(node.persistenceFile, callback);
                },
            
                params: ['lastTimestamp', function(data, callback) {
                    this.log('lastTimestamp', data.lastTimestamp);
                    callback(null, util.proofpointParams(data.lastTimestamp));
                }.bind(this)],
            
                proofpoint: ['params', function(data, callback) {
                    this.debug('poll', data.params.param);
                    this.status({ fill:"blue", shape:"ring", text:"polling" });
                    util.pollProofpointSIEM(principal, secret, data.params.param, function(err, body) {
                        if (err) {
                            this.status({ fill:"red", shape:"ring", text:err.message });
                            return callback(err);
                        }
                        this.status({});
                        return callback(null, body);
                    }.bind(this));
                }.bind(this)],
                
                // todo: stream to a lexical parser to avoid latency and memory overheads
                streamReputations: ['proofpoint', function(data, callback) {
                    util.extractReputations(data.proofpoint, function(reputation, callback) {
                        console.log('handle reputation', reputation);
                        node.send([{
                            payload: reputation
                        }]);
                        callback(null);
                    }, function(err, data) {
                        console.log('stream response', data);
                        callback(err, data);
                    });
                }],
            
                persist: ['streamReputations', function(data, callback) {
                    const lastTimestamp = data.proofpoint.queryEndTime;
                    console.log('persist?', lastTimestamp);
                    if ( !lastTimestamp || msg.payload.timestamp ) {
                        return callback(null);
                    }
                    util.persistLastTimeStamp(node.persistenceFile, lastTimestamp, function(err) {
                        return callback(err, lastTimestamp);
                    });
                }]
            
            }, function(err, data) {
                if (err) { 
                    return console.log(err);
                }
                const metadata = {
                    payload: {
                        lastTimestamp: data.proofpoint.queryEndTime
                    }
                };
                this.log('poll succeeded', data.persist, metadata);
                node.send([null, metadata]);
            }.bind(this));

            // msg.payload = msg.payload.toLowerCase();
            // node.send(msg);
        });
    }
    RED.nodes.registerType("poll proofpoint siem", Poll, {
        credentials: {
            principal: { type:"text" },
            secret: { type:"password" }
        }
    });
};
