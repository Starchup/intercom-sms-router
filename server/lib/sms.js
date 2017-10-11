var Intercom = require('intercom-client');
var client = new Intercom.Client(
{
	token: process.env.INTERCOM_TOKEN
});

function receive(data)
{
	if (!client) return Promise.resolve();

	var phone = data.From;
	if (!phone) return Promise.reject(new Error('No from phone provided'));

	return Promise.resolve();
}
module.exports.receive = receive;