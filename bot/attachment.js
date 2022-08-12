//** This file handles fetching attachments from Airtable and sending media content  to Line*/

const airtable = require('./airtable-methods')
var Airtable = require('airtable');
require('dotenv').config("./env")
var path = require('path')

const { ActivityTypes, CardFactory } = require('botbuilder');

var base = new Airtable({ apiKey: process.env.apiKey }).base(process.env.base);

/**
 * Check if the module contains any files
 * If yes, then fetch the file name and file URL from Airtable, and send the file based on its type.
 * @param {number} cDay - Current Day
 * @param {number} cModule - Current Module
 * @param {string} number - Unique User ID of the students.
 * @param {*} turnContext - Provides context for a turn of a bot.
 */
async function sendMediaFile(cDay, cModule, number, turnContext) {

    var course_tn = await airtable.findTable(number).then(`Table name of ${number} is ${course_tn}`).catch(e => console.log(e))

    const records = await base(course_tn).select({
        filterByFormula: "({Day} =" + cDay + ")",
        view: "Grid view",

    }).all(
    );

    return new Promise((resolve, reject) => {
        records.forEach(async function (record) {
            img = record.get("Module " + cModule + " File")


            if (img != undefined) {
                len = img.length
                console.log(len)
                try {
                    for (i = 0; i < len; i++) {
                        filename = img[i].filename
                        file_ext = path.extname(filename)
                        imgurl = img[i].url

                        const reply = { type: ActivityTypes.Message };

                        console.log("Delay of sending images")

                        // Get File extension
                        if (file_ext == ".mp4") {


                            reply.attachments = [await getInternetAttachment(filename, "video/mp4", imgurl)];
                            console.log(imgurl)

                        }
                        else if (file_ext == ".png" || file_ext == ".jpg") {
                            console.log(file_ext)
                            reply.attachments = [await getInternetAttachment(filename, "image/png", imgurl)]

                        }
                        else if (file_ext == ".txt" || file_ext == ".pdf" || file_ext == ".xlsx") {
                            console.log(file_ext)
                            await turnContext.sendActivity({ attachments: [await createDocumentCard(imgurl, filename)] })
                        }
                        resolve(await turnContext.sendActivity(reply))
                    }


                }
                catch (e) {
                    reject("Error ", e)

                }
            }
            else {
                console.log("No file in the module")
                resolve("ok")
            }

        });

    })
}

// Function to create card for sending documents.
async function createDocumentCard(url, title) {
    return CardFactory.heroCard(
        title,
        CardFactory.images([]),
        CardFactory.actions([
            {
                type: 'openUrl',
                title: 'Open Document',
                value: url
            }
        ])
    );
}

// Function to send images.
async function getInternetAttachment(filename, contentType, file_url) {

    // NOTE: The contentUrl must be HTTPS.
    return {
        name: filename,
        contentType: contentType,
        contentUrl: file_url
    };
}

module.exports = { sendMediaFile }


