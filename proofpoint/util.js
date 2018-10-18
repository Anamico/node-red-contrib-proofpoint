const fs = require('fs');
const request = require('request');
const async = require('async');

const constant = {
    hashType: {
        MD5: "md5",
        SHA1: "sha1",
        SHA256: "sha256"
    },

    fileProvider: {
        ENTERPRISE: 3
    },

    certProvider: {
        ENTERPRISE: 4
    },

    trustLevel: {
        KNOWN_TRUSTED_INSTALLER: 100,
        KNOWN_TRUSTED: 99,
        MOST_LIKELY_TRUSTED: 85,
        MIGHT_BE_TRUSTED: 70,
        UNKNOWN: 50,
        MIGHT_BE_MALICIOUS: 30,
        MOST_LIKELY_MALICIOUS: 15,
        KNOWN_MALICIOUS: 1,
        NOT_SET: 0,

        // reference: https://help.proofpoint.com/Threat_Insight_Dashboard/API_Documentation/SIEM_API
        // todo: make these default but customizable per environment/install?
        fromProofpoint: function(sandboxStatus) {
            if (sandboxStatus == 'threat') {
                return trustLevel.KNOWN_MALICIOUS;
            }
            if (sandboxStatus == 'clean') {
                return trustLevel.MOST_LIKELY_TRUSTED;
            }
            return null;
        }
    }
};

function extractAttachmentReputations(blocked, processReputation, message, mainCallback) {
    console.log('processing message', {
        messageID: message.messageID,               // increasing certainty: 0-100
        spamScore: message.spamScore,               // increasing certainty: 0-100
        impostorScore: message.impostorScore,       // increasing certainty: 0-100
        malwareScore: message.malwareScore          // increasing certainty: 0-100
    });
    async.eachSeries(message.messageParts || [], function(part, callback) {
        console.log('  processing part, sandboxStatus = ', part.sandboxStatus);
        const trustLevel = constant.trustLevel.fromProofpoint(part.sandboxStatus);
        if (trustLevel) {       // currently only 'threat' and 'clean'
            const payload = {
                trustLevel: trustLevel,
                providerId: constant.fileProvider.ENTERPRISE,
                filename: part.filename,
                comment: "from Proofpoint",
                hashes: [{
                    type: constant.hashType.MD5,
                    value: part.md5
                }, {
                    type: constant.hashType.SHA256,
                    value: part.sha256
                }]
            };
            return processReputation(payload, callback);
        }
        callback(null);
    }, mainCallback);
}



module.exports = {

    hashType: constant.hashType,
    fileProvider: constant.fileProvider,
    certProvider: constant.certProvider,
    trustLevel: constant.trustLevel,


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
                    extractAttachmentReputations.bind(this, true, processReputation),
                    callback);
            },
            messagesDelivered: function(callback) {
                async.eachSeries(payload.messagesBlocked || [],
                    extractAttachmentReputations.bind(this, false, processReputation),
                    callback);
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