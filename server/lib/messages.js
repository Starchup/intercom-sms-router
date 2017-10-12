/**
 * Env var checks
 */
if (!process.env.INTERCOM_TOKEN) throw new Error('INTERCOM_TOKEN env var required');
if (!process.env.TWILIO_SID) throw new Error('TWILIO_SID env var required');
if (!process.env.TWILIO_TOKEN) throw new Error('TWILIO_TOKEN env var required');
if (!process.env.TWILIO_NUMBER) throw new Error('TWILIO_NUMBER env var required');


/**
 * Dependencies
 */
const Intercom = require('intercom-client');
const Twilio = require('twilio');
const phoneParser = require('node-phonenumber');

const intercomClient = new Intercom.Client(
{
	token: process.env.INTERCOM_TOKEN
});
const smsClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);


/**
 * Exports
 */
function receivedSMS(data)
{
	if (!data.From) return Promise.reject(new Error('No from phone provided'));
	if (!data.Body) return Promise.reject(new Error('No sms body provided'));

	const formattedPhone = formatPhone(data.From);
	return findUserByPhone(formattedPhone).then(function (user)
	{
		return createUserMessage(user.id, data.Body).then(console.log);
	});
}
module.exports.sms = receivedSMS;


function receivedIntercom(data)
{
	return Promise.resolve();
}
module.exports.intercom = receivedIntercom;

/**
 * Utilities
 */
function createUserMessage(userId, body)
{
	return intercomClient.messages.create(
	{
		from:
		{
			type: "user",
			id: userId
		},
		body: body
	});
}

function findUserByPhone(phone, pages)
{
	let prom = Promise.resolve();
	if (pages) prom = intercomClient.nextPage(pages);
	else prom = intercomClient.users.list();

	return prom.then(function (res)
	{
		// If there are no more results then exit with an error
		if (!res.body.users.length)
		{
			throw new Error('No agent found with phone: ' + phone);
		}

		// Try to find the user by phone in this list
		const user = res.body.users.find(function (u)
		{
			return formatPhone(u.phone) === phone;
		});

		// If user was found, return it
		if (user) return user;

		if (!res.body.pages.next)
		{
			throw new Error('No agent found with phone: ' + phone);
		}

		// If user wasn't found, scroll to next page
		return findUserByPhone(phone, res.body.pages);
	});
};

function formatPhone(number)
{
	if (!number) return;

	const phoneUtil = phoneParser.PhoneNumberUtil.getInstance();
	const parsedNumber = phoneUtil.parse(number, 'US');

	return phoneUtil.format(parsedNumber, phoneParser.PhoneNumberFormat.NATIONAL);
}