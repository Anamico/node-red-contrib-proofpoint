# Proofpoint DXL Node-RED Client Nodes
[![Latest NPM Version](https://img.shields.io/npm/v/node-red-contrib-proofpoint.svg)](https://www.npmjs.com/package/node-red-contrib-proofpoint)
[![License](https://img.shields.io/github/license/Anamico/node-red-contrib-proofpoint.svg)](https://github.com/Anamico/node-red-contrib-proofpoint/blob/master/LICENSE)
[![Awesome](https://img.shields.io/badge/awesome-true-green.svg)](https://github.com/Anamico/node-red-contrib-proofpoint)

# Overview

The [Proofpoint](https://www.proofpoint.com/au/products/email-protection)
(SIEM) Node-RED client package enables the development of flows in
[Node-RED](https://nodered.org/) which use Proofpoint features (generate reputations, etc.) and enable integration with other security components, such as via the
[Data Exchange Layer](http://www.mcafee.com/us/solutions/data-exchange-layer.aspx) (DXL) fabric (such as with [node-red-contrib-dxl-tie-client](https://flows.nodered.org/node/@opendxl/node-red-contrib-dxl-tie-client)).

# Documentation

This node provides a wrapper and process for polling and retrieving/processing reputations from the Proofpoint TAP SIEM API.

To use this node you need a couple of things.

1. A set of TAP API credentials, see your proofpoint documentation on how to create these, you should end up with a principal and a secret key.
2. A way of persisting the "last" polled data timestamp.

## How it works

The Proofpoint SIEM API allows a customer of proofpoint to request certain data around convictions from their TAP service.

The API is a little clunky, in that you need to specify a period, you cannot get more than an hours worth of data (period width) and you cannot go back more than 14 days. Presumably this is implemented in this fashion to work around the natural limitation of batch retrievals. That is, the REST request to return reputations will respond with a list of reputations in a single response body that would grow too big to be manageable if unbound. Obviously some streaming approach would be a more manageable and modern approach, but this is what we are stuck with.

So in order to pull all reputations out of Proofpoint using this API, if you want to keep pulling them, then we need to make multiple calls to get up to date and need to continually poll to stay up to date.

This node helps achieve that. You set it up and in the absence of any alternate timestamp, it will start poll for the last hour the first time you trigger it. After the first successful retrieval, the "last sync" timestamp will be persisted and then used as the input to the following call.

So it is designed so you install it, configure the credentials for the Proofpoint SIEM API, and inject an initial timestamp. This will trigger a pull from proofpoint and on successful processing (extracting each reputation), it will persist the last sync timestamp to use as input for the next poll. Then, once seeded, you can set up a periodic input to send an empty payload on a regular basis to trigger another pull.

The node will take the mega returned list of reputations and spit out individual messages on the top output per reputation, ie: if you call this node once, at it receives 123 reputations, it will spit out 123 individual reputation messages on that top connector. The bottom connector will spit out a new timestamp being the end point for the last poll. This is persisted internally anyway for reuse (see below), but is also emitted on the second connector so you can update a dashboard or use it in a notification, etc.

The best way to use this noode is to ping it once with a start date/timestamp injection node to seed the system (using a timestamp in the last 2 weeks as a starting point), then set it up permanently with a repeating trigger with an empty msg payload, preferrably on a timer such as once every 10 minutes. What this means is if the system falls behind, then over time it will make 6 calls per hour of up to 1 hour of historical data, eventually coming up to the current time again.

## Persistance

In order for the system to work properly (poll repeatedly to continue to retrieve the latest reputations), the node needs to persist each last timestamp and use it on the following call, even if the node instance is shut down or reboots.

To do this, you pick one of 3 options.

1. Specify a path to a persistence file,
2. Specify a global variable name for persistence, or
3. Rely on a default global persistence variable for the node.

Note that for options 2 or 3, it is advised to set up storage in the node instance, otherwise a reboot or restart of the process will lose the last timestamp and the process will not know where to start again.
For option 1, the node process will need read/write access to the destination path and the path needs to exist.

## A few notes about working behind a corporate proxy

I realise the majority of enterprise installations will be working behind a proxy. This just requires a few extra steps for installation of node-red, node-red plugins and connection to the Proofpoint TAP SIEM APIs. But this these nodes have been installed successfully in quite a few large organisations with strict security with no issues. Just take some time to work out the extra steps required as a vanilla node-red installation does not readily support this deployment without a little extra work.

Bear in mind also, if you are prototyping this for an organisation on a workstation or VM, you are most likely going to need a few exceptions or to run with something like fiddler. This is a well known requirement for utilising node-red behind a proxy and is by virtue of how proxies work. The solutions are available and you just need to choose the combination appropriate for your environment.

Once you are installing into production, the process should become easier as proxy rules can be attached to appropriate server classes/groupings to allow unauthenticated proxy traffic or proxy bypass to required endpoints as you see fit in your organisation. 

# Bugs and Feedback

For bugs, questions and discussions please log/discuss here 
[GitHub Issues](https://github.com/Anamico/node-red-contrib-proofpoint/issues).

# LICENSE

Copyright (c) 2018 Andrew Longhorn <Andrew_Longhorn@McAfee.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
