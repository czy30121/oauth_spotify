const fs = require("fs");
const path = require("path");
const request = require("request-promise");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const uuid = require("uuid").v4;

const db = admin.firestore();
const CLIENT_ID = "CLIENT_ID";
const CLIENT_SECRET = "CLIENT_SECRET";
const PARTNER_ID = "PARTNER_ID";
const SUCCESS_PAGE_URL = "https://www.mamamia.com.au/subscriber-hub/";

const renderErrorPage = (res) => {
	fs.readFile(path.resolve("./handlers/oauth/error.html"), function read(err, data) {
		if (err) {
			console.log(err);
			res.json({
				error: "No response",
			});
		}
		res.writeHeader(200, { "Content-Type": "text/html" });
		res.write(data);
		res.end();
	});
};

const getPartnerUserId = async (uid) => {
	let partnerUserId;

	partnerUserId = uuid().split("-").join("");
	await db.collection("accounts").doc(uid).update(
		{
			partner_user_id: partnerUserId,
		},
		{ merge: true }
	);
	// note: spotify api does not want dashes
	return partnerUserId;
};

const getUserData = async (uid) => {
	console.log("Get the user data");
	var uData = {};
	var mappingRef = await db.collection("accounts").doc(uid).get();
	var userDoc = mappingRef.data();

	if (userDoc["status"] && userDoc["status"] == "paid") {
		uData.isPaid = true;
	} else {
		uData.isPaid = false;
	}
	if (userDoc["partner_user_id"]) {
		uData.partnerUserId = userDoc["partner_user_id"];
	} else {
		uData.partnerUserId = false;
	}
	console.log("the udata", uData);
	return uData;
};

const handler = async (req, res) => {
	console.log("It enters the handler Function");
	const { code, state, error } = req.query;
	if (error) {
		console.log("it found error");
		console.error(error);
		return renderErrorPage(res);
	} else if (!state) {
		console.log("it found state missing");
		return renderErrorPage(res);
	}
	try {
		console.log("It went to the try bit");
		const payload = JSON.parse(state);
		// prettier-ignore
		// eslint-disable-next-line no-undef
		console.log('payload', payload);
		//Get user data
		var userData = await getUserData(payload.uid);
		if (!userData.isPaid) {
			console.log("it found unpaid user");
			return renderErrorPage(res);
		}

		const requestToken = "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64");
		const response = await request({
			method: "POST",
			url: "https://accounts.spotify.com/api/token",
			form: {
				code: code,
				redirect_uri: payload.redirectUri,
				grant_type: "authorization_code",
				scope: "soa-manage-entitlements soa-manage-partner",
			},
			headers: {
				Authorization: requestToken,
			},
			json: true,
		});
		console.log("The response is : ");
		console.log(response);
		console.log("just before partner id");
		let PARTNER_USER_ID;
		if (userData.partnerUserId) {
			PARTNER_USER_ID = userData.partnerUserId;
		} else {
			PARTNER_USER_ID = await getPartnerUserId(payload.uid);
		}
		console.log("partner user id = " + PARTNER_USER_ID);
		if (!PARTNER_USER_ID) {
			return renderErrorPage(res);
		}

		const jwtParams = {
			entitlements: ["Mplus", "offline_access"],
			partner_id: PARTNER_ID,
			partner_user_id: PARTNER_USER_ID,
		};
		console.log("JWT PARAMS");
		console.log(jwtParams.entitlements);
		const signature = jwt.sign(jwtParams, CLIENT_SECRET, {
			algorithm: "HS256",
			header: {
				typ: "JWT",
			},
		});
		console.log("Just before rego");
		const registration = await request({
			method: "POST",
			url: "https://open-access.spotify.com/api/v1/register-user",
			body: signature,
			headers: {
				Authorization: `Bearer ${response.access_token}`,
				//"Content-Type": "text/plain",
				"Content-Type": "application/json",
			},
		});
		var regoObj = JSON.parse(registration);
		console.log("here is rego done", regoObj);
		res.redirect(regoObj.completion_url);
		//res.redirect("https://content-access.spotify.com/oauth/success?shows=");
	} catch (err) {
		let errorMessage = err.message;

		if (err.response && err.response.body) {
			errorMessage = err.response.body;
		}
		console.log("Here is the error ");
		console.log(errorMessage);
		return renderErrorPage(res, errorMessage);
	}
};

module.exports = (cors, db) => (req, res) => {
	cors(req, res, async () => {
		console.log("It enters the callback CF");
		if (req.method === "GET") {
			return handler(req, res, db);
		}
		res.status(405).send("method not allowed");
	});
};
