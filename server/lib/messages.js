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
	return findOrCreateUserByPhone(formattedPhone).then(function (theUser)
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


function receivedCustomerIntercom()
{
	return smsClient.messages.create(
	{
		to: "33666347944‬",
		from: "33757903594",
		body: 'Intercom msg'
	});
}
module.exports.customerIntercom = receivedCustomerIntercom;

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

function findOrCreateUserByPhone(phone)
{
	return findUserByPhone(phone).catch(function ()
	{
		return findUserByPhone(phone, true);
	}).catch(function ()
	{
		return intercomClient.users.create(
		{
			phone: phone,
			user_id: Date.now()
		}).then(function (res)
		{
			return res.body;
		});
	});
};

function findUserByPhone(phone, tempUser, pages)
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
			// If you're looking for real users but this one has no email, exit
			// since they aren't a real user
			if (!tempUser && !u.email) return false;

			return formatPhone(u.phone) === phone;
		});

		// If user was found, return it
		if (user) return user;

		if (!res.body.pages.next)
		{
			throw new Error('No agent found with phone: ' + phone);
		}

		// If user wasn't found, scroll to next page
		return findUserByPhone(phone, tempUser, res.body.pages);
	});
};

function findActiveConvo(userId)
{
	return intercomClient.conversations.list(
	{
		sort: 'updated_at',
		intercom_user_id: userId
	}).then(function (res)
	{
		if (!res.body.conversations) return;

		return res.body.conversations.find(function (c)
		{
			return c.user.id === userId && isSMSConvo(c);
		});
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