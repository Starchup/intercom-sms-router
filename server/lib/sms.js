var Intercom = require('intercom-client');
var client = new Intercom.Client(
{
	token: process.env.INTERCOM_TOKEN
});

function receive(data)
{
	if (!client) return Promise.resolve();

	if (!data.From) return Promise.reject(new Error('No from phone provided'));

	return client.users.find(
	{
		phone: data.From
	});
}
module.exports.receive = receive;