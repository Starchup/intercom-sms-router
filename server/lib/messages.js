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

const starchupLogo = 'https://s3-us-west-2.amazonaws.com/starchup.com/icon.png';


/**
 * Exports
 */
function receivedSMS(data)
{
	if (!data.From) return Promise.reject(new Error('No from phone provided'));
	if (!data.Body) return Promise.reject(new Error('No sms body provided'));

	let user;
	const formattedPhone = formatPhone(data.From);
	return findUserByPhone(formattedPhone).then(function (theUser)
	{
		user = theUser;
		return findActiveConvo(user.id);
	}).then(function (activeConvo)
	{
		if (!activeConvo) return createUserMessage(user.id, data.Body);
		else return respondToConvo(user.id, activeConvo.id, data.Body);
	});
}
module.exports.sms = receivedSMS;


function receivedIntercom(data)
{
	if (!data.user)
	{
		return Promise.reject(new Error('No user provided: ' + JSON.stringify(data)));
	}
	if (!data.conversation_parts || !data.conversation_parts.conversation_parts)
	{
		return Promise.reject(new Error('No conversation_parts provided: ' + JSON.stringify(data)));
	}
	if (!data.conversation_parts.conversation_parts.length)
	{
		return Promise.reject(new Error('No conversation_parts messages: ' + JSON.stringify(data)));
	}

	if (!isSMSConvo(data)) return Promise.resolve();

	return findUserById(data.user.id).then(function (user)
	{
		if (!user.phone) throw new Error('User has no phone: ' + JSON.stringify(user));
		const currentMsg = data.conversation_parts.conversation_parts[0];
		var message = htmlToText.fromString(currentMsg.body);
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

		return user.body;
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

function findActiveConvo(userId, pages, existingConvos)
{
	return findAllUserSMSConvos(userId).then(function (convos)
	{
		if (!convos || !convos.length) return;

		return convos.sort(function (a, b)
		{
			return b.updated_at - a.updated_at;
		})[0];
	});
}

function findAllUserSMSConvos(userId, pages, convos)
{
	const query = {};

	let prom = Promise.resolve();
	if (pages) prom = intercomClient.nextPage(pages);
	else prom = intercomClient.conversations.list(query);

	if (!convos) convos = [];

	return prom.then(function (res)
	{
		// If there are no more results then exit with an error
		if (!res.body.conversations.length) return convos;

		// Try to find the user by phone in this list
		convos = convos.concat(res.body.conversations.filter(function (c)
		{
			return c.user.id === userId && isSMSConvo(c);
		}));

		if (!res.body.pages.next) return convos;

		// If user wasn't found, scroll to next page
		return findAllUserSMSConvos(userId, res.body.pages, convos);
	});
}

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
		attachment_urls: [starchupLogo]
	});
}

function createUserSMS(phone, body)
{
	return smsClient.messages.create(
	{
		to: phone,
		from: process.env.TWILIO_NUMBER,
		body: body

	});
}

function respondToConvo(userId, convoId, body)
{
	return intercomClient.conversations.reply(
	{
		id: convoId,
		type: 'user',
		intercom_user_id: userId,
		body: htmlToText.fromString(body),
		message_type: 'comment'
	});
}

function isSMSConvo(convo)
{
	if (!convo.open) return false;

	if (!convo.conversation_message.attachments) return false;
	if (!convo.conversation_message.attachments.length) return false;

	const attachment = convo.conversation_message.attachments[0];
	if (!attachment || !attachment.url) return false;

	return attachment.name === 'icon.png';
}

function formatPhone(number)
{
	if (!number) return;

	const phoneUtil = phoneParser.PhoneNumberUtil.getInstance();
	const parsedNumber = phoneUtil.parse(number, 'US');

	return phoneUtil.format(parsedNumber, phoneParser.PhoneNumberFormat.NATIONAL);
}