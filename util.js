const fs = require('fs');
const request = require('request');
const async = require('async');

function extractAttachmentReputations(processReputation, message, mainCallback) {
    console.log('processing message', message.threatStatus, message.classification, message.messageParts);
    async.eachSeries(message.messageParts || [], function(part, callback) {
        console.log('  processing part, sandboxStatus = ', part.sandboxStatus);
        //if (part.sandboxStatus == "threat") {
            const payload = {
                trustLevel: 1,  // KNOWN_MALICIOUS
                providerId: 3,  // ENTERPRISE
                filename: part.filename,
                comment: "from Proofpoint",
                hashes: [{
                    type: "md5",
                    value: part.md5
                }, {
                    type: "sha256",
                    value: part.sha256
                }]
            };
            return processReputation(payload, callback);
        //}
        //callback(null);
    }, mainCallback);
}



module.exports = {
    /**
     * Retrieve last timestamp from persistence file
     */
    retrieveLastTimeStamp: function (persistenceFilePath, callback) {

        if (!fs.existsSync(persistenceFilePath)) {
            return callback(null, null);
        }

        fs.readFile(persistenceFilePath, function read(err, data) {
            if (err) {
                return callback(err);
            }
            content = JSON.parse(data);
            console.log('decoded persistent file content', content);
            callback(null, content && content.lastTimestamp);
        });
    },

    /**
     * 
     * Generate 
     * @param {*} config 
     */
    proofpointParams: function (lastTimestamp) {
        const now = (new Date()).getTime() / 1000; //- tzoffset
        const oldestAllowed = now - (7 * 24 * 60 * 60) + 60; // allow a 1 minute buffer

        const startUnix = Math.max(
            (lastTimestamp && ((new Date(lastTimestamp)).getTime() / 1000)) || 0,
            oldestAllowed);

        const endUnix = Math.min(
            startUnix + (60 * 60),
            now);

        const startTime = new Date(startUnix * 1000).toISOString();
        const endTime = new Date(endUnix * 1000).toISOString();
        const param = startUnix + (60 * 60) > now ?
                    "sinceTime=" + startTime :
                    "interval=" + startTime + "/" + endTime;
                    
        return {
            startTime: startTime,
            endTime: endTime,
            param: param
        };
    },

    extractReputations: function(payload, processReputation, callback) {
        async.auto({
            messagesBlocked: function(callback) {
                async.eachSeries(payload.messagesBlocked || [],
                    extractAttachmentReputations.bind(this, processReputation),
                    callback);
            },
            messagesDelivered: function(callback) {
                callback(null);
            },
            clicksBlocked: function(callback) {
                callback(null);
            },
            clicksPermitted: function(callback) {
                callback(null);
            }
        }, callback);
    },

    pollProofpointSIEM: function(username, password, param, callback) {
        //const url = 'https://tap-api-v2.proofpoint.com/v2/siem/all?threatType=attachment&format=JSON&' + data.params.param;
        const uri = 'https://tap-api-v2.proofpoint.com/v2/siem/all?format=JSON&' + param;

        request({
            method: 'GET',
            uri: uri,
            json: true,
            auth: {
                user: username,
                pass: password,
                sendImmediately: true // default is true anyway
            }
        }, function (error, response, body) {
            if (error || (!response.statusCode == 200)) {
                return callback(error || new Error('Request Error'));
            }
            console.log('proofpoint payload:', body);
            callback(null, body);
        });
    },

    persistLastTimeStamp: function (persistenceFilePath, timestamp, callback) {
        const jsonString = JSON.stringify({
            lastTimestamp: timestamp
        });
        fs.writeFile(persistenceFilePath, jsonString, callback);
    }
};