var Intercom = require('intercom-client');
var client = new Intercom.Client(
{
	token: process.env.INTERCOM_TOKEN
});

function receive(data)
{
	if (!client) return Promise.resolve();

	if (!data.user) return Promise.reject(new Error('Invalid intercom data'));

	return client.users.find(
	{
		id: data.user.id
	});
}
module.exports.receive = receive;