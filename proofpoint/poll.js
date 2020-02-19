const util = require('./util.js');
const async = require('async');

module.exports = function(RED) {

    function Poll(config) {
        RED.nodes.createNode(this, config);
        this.persistenceFile = config.persistenceFile;
        const node = this;

        node.persistenceVar = (config.persistenceVar && config.persistenceVar.length && (config.persistenceVar.length > 0) && config.persistenceVar) ||
            ('proofpointPersistence-' + node.id.replace(/\./g, '_'));

        node._proofpoint = RED.nodes.getNode(config.proofpoint);

        node.on('input', function(msg) {
            var globalContext = this.context().global;
            async.auto({
                executionTime: function(callback) {
                    return callback(null, (new Date()).toISOString());
                },

                lastTimestamp: ['executionTime', function(data, callback) {
                    if (msg.payload.lastTimestamp) {
                        return callback(null, msg.payload.lastTimestamp);
                    }
                    var defaultStart = new Date();
                    defaultStart.setDate(defaultStart.getDate() - 12); // Default start is 12 days prior to now
                    // use a persistence file first, but if that doesn't work, try for a persistence var or default it
                    if (node.persistenceFile && node.persistenceFile.length && (node.persistenceFile.length > 0)) {
                        util.retrieveLastTimeStamp(node.persistenceFile, function(err, lastTimestamp) {
                            if (err || lastTimestamp) { callback(err, lastTimestamp); }
                            lastTimestamp = globalContext.get(node.persistenceVar) || defaultStart.toISOString();
                            callback(null, lastTimestamp);
                        });
                    } else {
                        lastTimestamp = globalContext.get(node.persistenceVar) || defaultStart.toISOString();
                        callback(null, lastTimestamp);
                    }
                }],
            
                validStart: ['lastTimestamp', function(data, callback) {
                    const timeStamp = new Date(data.lastTimestamp);
                    if (!timeStamp) {
                        const err = new Error('Missing/Invalid lastTimestamp');
                        node.status({ fill:"red", shape:"ring", text:err.message });
                        return callback(err);
                    }

                    var earliest = new Date();
                    earliest.setDate(earliest.getDate() - 14);

                    if (timeStamp < earliest) {
                        const err = new Error('Timestamp > 14 days old');
                        node.status({ fill:"red", shape:"ring", text:err.message });
                        return callback(err);
                    }

                    return callback(null);
                }],

                params: ['validStart', function(data, callback) {
                    node.log('lastTimestamp', data.lastTimestamp);
                    callback(null, util.proofpointParams(data.lastTimestamp));
                }],
            
                proofpoint: ['params', function(data, callback) {
                    node.debug('poll', data.params.param);
                    node.status({ fill:"blue", shape:"ring", text:"polling" });
                    node._proofpoint.poll(data.params.param, function(err, body) {
                        if (err) {
                            node.status({ fill:"red", shape:"ring", text:err.message });
                            return callback(err);
                        }
                        node.status({});
                        node.warn(body);
                        return callback(null, body);
                    });
                }],
                
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
            
                newLastTimestamp: ['streamReputations', function(data, callback) {
                    callback(null, data.proofpoint.queryEndTime);
                }],

                persistFile: ['newLastTimestamp', function(data, callback) {
                    console.log('persist?', data.newLastTimestamp);
                    if ( !data.newLastTimestamp ) {
                        return callback(null);
                    }
                    util.persistLastTimeStamp(node.persistenceFile, data.newLastTimestamp, function(err) {
                        return callback(err, data.newLastTimestamp);
                    });
                }],

                persistVar: ['newLastTimestamp', function(data, callback) {
                    console.log('persist var?', node.persistenceVar, data.newLastTimestamp);
                    if ( !data.newLastTimestamp ) {
                        return callback(null);
                    }
                    globalContext.set(node.persistenceVar, data.newLastTimestamp);
                }]
            
            }, function(err, data) {
                if (err) { 
                    return console.log(err);
                }
                const metadata = {
                    payload: {
                        lastTimestamp: data.newLastTimestamp
                    }
                };
                this.log('poll succeeded', data.newLastTimestamp, metadata);
                node.send([null, metadata]);
            }.bind(this));

            // msg.payload = msg.payload.toLowerCase();
            // node.send(msg);
        });
    }
    RED.nodes.registerType("poll proofpoint siem", Poll);
};
