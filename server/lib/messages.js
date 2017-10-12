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
const htmlToText = require('html-to-text');

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
	console.log('receivedSMS');
	if (!data.From) return Promise.reject(new Error('No from phone provided'));
	if (!data.Body) return Promise.reject(new Error('No sms body provided'));

	const formattedPhone = formatPhone(data.From);
	return findUserByPhone(formattedPhone).then(function (user)
	{

		return createUserMessage(user.id, data.Body);
	});
}
module.exports.sms = receivedSMS;


function receivedIntercom(data)
{
	console.log('receivedIntercom');

	if (!data.user)
	{
		return Promise.reject(new Error('No user provided: ' + JSON.stringify(data)));
	}
	if (!data.conversation_parts)
	{
		return Promise.reject(new Error('No conversation_parts provided: ' + JSON.stringify(data)));
	}
	if (!data.conversation_parts.length)
	{
		return Promise.reject(new Error('No conversation_parts provided: ' + JSON.stringify(data)));
	}
	if (!data.tags || !data.tags.tags || !data.tags.tags.length) return;

	const smsTag = data.tags.tags.find(function (t)
	{
		return t.name === 'sms_convo';
	});
	if (!smsTag) return;

	return findUserById(data.user.id).then(function (user)
	{
		if (!user.phone) throw new Error('User has no phone: ' + JSON.stringify(user));
		var message = htmlToText.fromString(data.conversation_parts[0].body);
		return createUserSMS(user.phone, message);
	});
}
module.exports.intercom = receivedIntercom;

/**
 * Utilities
 */
function findUserById(intercomId)
{
	return intercomClient.users.find(
	{
		id: intercomId
	}).then(function (user)
	{
		// If no agents were found, throw an error
		if (!user)
		{
			throw new Error('No agent found with id: ' + intercomId);
		}

		return user;
	});
};

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

function createUserMessage(userId, body)
{
	return intercomClient.messages.create(
	{
		from:
		{
			type: "user",
			id: userId
		},
		body: body,
	}).then(function (res)
	{
		return intercomClient.tags.tag(
		{
			name: 'sms_convo',
			messages: [
			{
				id: res.body.id
			}]
		});
	});
}

function createUserSMS(phone, body)
{
	console.log('creating a message');
	return smsClient.messages.create(
	{
		to: phone,
		from: process.env.TWILIO_NUMBER,
		body: body

	});
}

function formatPhone(number)
{
	if (!number) return;

	const phoneUtil = phoneParser.PhoneNumberUtil.getInstance();
	const parsedNumber = phoneUtil.parse(number, 'US');

	return phoneUtil.format(parsedNumber, phoneParser.PhoneNumberFormat.NATIONAL);
}