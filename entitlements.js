const entitlements = (cors, db) => (req, res) => {
	cors(req, res, async () => {
		const authHeader = req.headers.authorization;
		const bearerToken = authHeader.split(" ")[1];
		if (bearerToken) {
			const bearerTokenResult = await db.collection("oauth").doc("codes").collection("tokens").where("token", "==", bearerToken).get();

			if (!bearerTokenResult.docs[0]) {
				console.log("sending", {
					error: "Invalid token",
				});
				return res.json({
					error: "Invalid token",
				});
			}

			const bearerTokenData = bearerTokenResult.docs[0].data();
			const uid = bearerTokenData.user.uid;
			const userResult = await db.collection("accounts").doc(uid).get();
			const userData = userResult.data();
			if (userData.status === "paid") {
				console.log("sending", {
					sub: uid,
					entitlements: ["Mplus"],
				});
				return res.json({
					sub: uid,
					entitlements: ["Mplus"],
				});
			}
			console.log("sending", {
				sub: uid,
				entitlements: [],
			});
			return res.json({
				sub: uid,
				entitlements: [],
			});
		}
		return res.json({ error: "Authorization Headers Required" });
	});
};

module.exports = entitlements;
