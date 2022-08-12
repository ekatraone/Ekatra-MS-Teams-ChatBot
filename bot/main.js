//* This file handles the following tasks:
//* 1. Updating day and module values of individual students in Airtable.
//* 2. Fetching and sending the course content based on each student's enrolled course and progress.

var Airtable = require('airtable');
require('dotenv').config();
const { TurnContext, MessageFactory, CardFactory } = require("botbuilder");
const airtable = require('./airtable-methods');
const attachment = require('./attachment');

var conversationReferences = {};
var adapter;
var base = new Airtable({ apiKey: process.env.apiKey }).base(process.env.base);

/** This function handles storing list option selected by the student in Airtable field named Responses
 * Called when the student selects the option from the list message.
 * @param {string} number - Unique User ID of the student
 * @param {string} value  - Option selected from the list
 * @param {*} context - Provides context for a turn of a bot.

 */
async function store_responses(number, value, context) {

    const curUser = context.activity.from.id;
    conversationReferences[curUser] = TurnContext.getConversationReference(context.activity);
    adapter = context.adapter;

    const records = await base("MS-Students").select({
        filterByFormula: `({Phone} = "${number}")`,
        view: "Grid view",

    }).all(
    );

    records.forEach(async function (record) {

        let id = record.id
        let currentModule = record.get("Next Module")
        let currentDay = record.get("Next Day")

        let list = await airtable.findTitle(number, currentDay, currentModule)
        let existingValues = await airtable.findRecord(id)

        let title = list[0]
        let options = list.filter((v, i) => i !== 0)

        for (i = 0; i < options[0].length; i++) {

            if (options[0][i] == value) {
                if (existingValues == undefined) {
                    existingValues = ""
                    newValues = title + "\n" + value

                }
                else {

                    newValues = existingValues + "\n\n" + title + value
                }

                await adapter.continueConversation(conversationReferences[curUser], async turnContext => {
                    if (existingValues.includes(title)) {
                        console.log("Feedback already recorded ")
                        await findContent(currentDay, currentModule, number, turnContext)
                    }
                    else {
                        airtable.updateField(id, "Response", newValues).then(async () => {


                            const cu = turnContext._activity.from.id;
                            conversationReferences[cu] = TurnContext.getConversationReference(turnContext._activity);

                            console.log("New Feedback recorded ")

                            findContent(currentDay, currentModule, number, cu)
                        })
                    }
                })
                break
            }
        }
    })
}

/** Executed after updating the Airtable Response field and continues the flow.
 * @param {number} currentDay 
 * @param {number} module_No - current module number
 * @param {string} number - Unique User ID of the student
 * @param {*} context - Provides context for a turn of a bot.
 */
async function findContent(currentDay, module_No, number, context) {
    var course_tn = await airtable.findTable(number)
    const records = await base(course_tn).select({
        filterByFormula: "({Day} =" + currentDay + ")",
        view: "Grid view",

    }).all(
    );

    if (context._activity == undefined) {
        cu = context

    }
    else {
        cu = context._activity.from.id;
        conversationReferences[cu] = TurnContext.getConversationReference(context._activity);
        adapter = context.adapter;
    }

    records.forEach(async function (record) {
        var data = ""

        var day = record.get("Day")
        var module_link = record.get("Module " + module_No + " Link")

        await adapter.continueConversation(conversationReferences[cu], async turnContext => {
            if (!!module_link) {
                console.log("Module link not empty in FD ")

                data = module_link

                await adapter.continueConversation(conversationReferences[cu], async turnContext => {
                    await turnContext.sendActivity(data)
                })

            }

            const hTxt = `Let's move forward! 
            
            Click below `
            const btnTxt = "Next Module"

            delay(3000).then(async () => {
                await adapter.continueConversation(conversationReferences[cu], async turnContext => {
                    await sendInteractiveButtonsMessage(btnTxt, hTxt, turnContext).then().catch(e => console.log("SI error in findContent" + e))
                })
            })

        })
    })
}

/**
 * Send List Interactive Message to the students
 * @param {number} currentDay 
 * @param {number} module_No - current module number
 * @param {string} number - Unique User ID of the student
 * @param {string} curUser - Current User ID for the context
 */
async function sendList(currentDay, module_No, number, curUser) {
    var course_tn = await airtable.findTable(number)
    const records = await base(course_tn).select({
        filterByFormula: "({Day} =" + currentDay + ")",
        view: "Grid view",

    }).all(
    );
    records.forEach(async function (record) {
        let module_title = record.get("Module " + module_No + " LTitle")
        let module_list = record.get("Module " + module_No + " List")

        console.log("Executing List")
        options = module_list.split("\n").filter(n => n)

        let d = []
        for (const row of options) {
            d.push(row)
        }

        await adapter.continueConversation(conversationReferences[curUser], async turnContext => {

            await attachment.sendMediaFile(currentDay, module_No, number, turnContext).then().catch(e => console.log("Error sendMediaFile in sendList " + e))

        })

        delay(5000).then(async () => {
            await adapter.continueConversation(conversationReferences[curUser], async turnContext => {
                await createListMessage(d, module_title, turnContext).then().catch(e => console.log("List error " + e))

            })
        })
    })
}

/** This functions continues the flow based on student's progress  
 * @param {string} number - Unique User ID of the student
* @param {*} context - Provides context for a turn of a bot.
 */
async function sendModuleContent(number, context) {

    const records_Student = await base('MS-Students').select({
        filterByFormula: `({Phone} = '${number}' )`,
        view: "Grid view",

    }).all();
    records_Student.forEach(function (record) {
        console.log("Entered sendModuleContent")


        var cDay = record.get("Next Day")
        var next_module = record.get("Next Module") // 0

        if (next_module == Number(0)) {
            console.log("currentUser", currentUser)

            // A conversation reference for the conversation that contains this activity, An object relating to a particular point in a conversation, 
            const cu = context.activity.from.id; //user id
            conversationReferences[cu] = TurnContext.getConversationReference(context.activity);
            adapter = context.adapter;

            sendEndMessage(cDay, number, cu);

        }
        else {
            console.log("Next module No ", next_module)

            const cu = context.activity.from.id;

            conversationReferences[cu] = TurnContext.getConversationReference(context.activity);

            adapter = context.adapter;


            findModule(cDay, next_module, number, cu).then().catch(e => console.log("FM error 1 " + e))
        }

    })

}


/** This function finds the current module of the respective students and sends the content accordingly. 
 * Executed only if module text or module list is not empty 
 * @param {number} currentDay 
 * @param {number} module_No - current module number
 * @param {number} number - Unique User ID of the student
 * @param {string} current_user - User ID of the current user.
 */
async function findModule(currentDay, module_No, number, current_user) {

    var course_tn = await airtable.findTable(number)

    const records = await base(course_tn).select({
        filterByFormula: "({Day} =" + currentDay + ")",
        view: "Grid view",

    }).all(
    );

    records.forEach(async function (record) {

        var day = record.get("Day")

        var module_text = record.get("Module " + module_No + " Text")
        let module_title = record.get("Module " + module_No + " LTitle")
        var module_link = record.get("Module " + module_No + " Link")

        console.log("Executing FindModule")

        // Action which continues a conversation using a Conversation reference
        await adapter.continueConversation(conversationReferences[current_user], async turnContext => {

            if (!!module_title && !module_text) {
                await sendList(currentDay, module_No, number, current_user)

            }
            else if (!!module_text && !module_title) {

                if (!!module_link) {
                    console.log("Module link not empty ")

                    data = module_text
                    await turnContext.sendActivity(data);

                    delay(2000).then(async () => {
                        // Action which continues a conversation using a Conversation reference
                        await adapter.continueConversation(conversationReferences[current_user], async turnContext => {

                            await attachment.sendMediaFile(day, module_No, number, turnContext).then(v => console.log("Media in Module link not empty ", v)).catch(e => console.log("Media error 1 ", e))


                        })
                    })

                    delay(5000).then(async () => {
                        await adapter.continueConversation(conversationReferences[current_user], async turnContext => {

                            await turnContext.sendActivity(module_link).then(console.log("Link Sent ")).catch(error => console.log("Module Link error " + error));
                        })
                    })


                }
                else {

                    data = module_text
                    console.log("Module link null ")

                    await turnContext.sendActivity(data);

                    delay(5000).then(async () => {
                        await adapter.continueConversation(conversationReferences[current_user], async turnContext => {
                            await attachment.sendMediaFile(day, module_No, number, turnContext).then().catch(e => console.log("Media error in module linkk null ", e))
                        })
                    })
                }
                delay(10000).then(async () => {
                    await adapter.continueConversation(conversationReferences[current_user], async turnContext => {
                        const hTxt = `Let's move forward! Click below`
                        const btnTxt = "Next Module"
                        console.log("Delay of Finish Interactive Button")

                        await sendInteractiveButtonsMessage(btnTxt, hTxt, turnContext).then().catch(e => console.log("SI error in FindModule " + e))
                    })
                })


            }
            else if (!!module_text && !!module_title) {
                data = module_text
                await turnContext.sendActivity(data);

                await sendList(currentDay, module_No, number, current_user)
            }

            else {

                markModuleComplete(number, current_user)
            }

        })
    });
}

/**
 * Check if the next module is greater than 10
 * If yes, then update columns Next Module to 0 and Module Completed to the current module number.
 * Otherwise, update Next Module by 1 and Module Completed to the Next Module.
 * Also executed when Next keyword is received
 * @param {string} number - Unique User ID of the students
 * @param {*} context - Provides context for a turn of a bot.

 */
async function markModuleComplete(number, context) {
    const records_Student = await base('MS-Students').select({
        filterByFormula: `({Phone} = '${number}' )`,
        view: "Grid view",

    }).all();
    records_Student.forEach(function (record) {
        console.log("Entered markModuleComplete")
        var id = record.id

        var current_module = Number(record.get("Next Module")) //1 
        var cDay = Number(record.get("Next Day"))

        var next_module = current_module + 1

        if (next_module > 10) {

            airtable.updateField(id, "Module Completed", current_module)

            airtable.updateField(id, "Next Module", 0)
            if (context._activity == undefined) {

                sendEndMessage(cDay, number, context);

            }
            else {
                conversationReferences[context._activity.from.id] = TurnContext.getConversationReference(context._activity);
                adapter = context._adapter;

                sendEndMessage(cDay, number, context._activity.from.id);
            }

        }

        else {


            if (context._activity == undefined) {
                sendEndMessage(cDay, number, context);

            }
            else {
                airtable.updateField(id, "Next Module", next_module)
                airtable.updateField(id, "Module Completed", current_module)

                conversationReferences[context._activity.from.id] = TurnContext.getConversationReference(context._activity);

                adapter = context._adapter;

                findModule(cDay, next_module, number, context._activity.from.id)
            }

        }


    });
}

/**Update Day Completed field and Next Day field in Student's table of the student
 * Called when received Finish day keyword
 * @param {string} number - Unique User ID of the students.
 * @param {string} current_user - User ID of the current user.
 */
async function markDayComplete(number, currentUser) {
    const records_Student = await base('MS-Students').select({
        filterByFormula: `({Phone} = '${number}')`,
        view: "Grid view",

    }).all();

    total_days = 0
    var total_days = await airtable.totalDays(number).then().catch(e => console.log("markDayComplete error " + e))

    records_Student.forEach(function (record) {
        console.log("Entered markDayComplete")

        var id = record.id
        var comp_day = Number(record.get("Next Day"))
        var nextDay = comp_day + 1

        if (comp_day <= total_days) {

            try {
                airtable.updateField(id, "Next Day", nextDay).then()
                    .catch(e => console.log("1", e))

                airtable.updateField(id, "Day Completed", comp_day).then()
                    .catch(e => console.log("2", e))

                console.log("Complete Day " + comp_day)

                //Reset module numbers
                const next_mod = 1
                const module_completed = 0
                airtable.updateField(id, "Next Module", next_mod).then()
                    .catch(e => console.log("3", e))

                airtable.updateField(id, "Module Completed", module_completed).then()
                    .catch(e => console.log("4", e))
            }
            catch (e) {
                console.log("Error while updating complete day " + e)
            }
        }


    });
}

/** Send end day interactive message to the students. 
 * 
 * @param {*} currentDay 
 * @param {*} number - Unique User ID of the students.
 * @param {string} current_user - User ID of the current user.
 */
async function sendEndMessage(currentDay, number, currentUser) {
    var course_tn = await airtable.findTable(number).then(`Table name of ${number} is ${course_tn}`).catch(e => console.log(e))
    const records = await base(course_tn).select({
        filterByFormula: "({Day} =" + currentDay + ")",
        view: "Grid view",

    }).all(
    );
    records.forEach(async function (record) {
        console.log("Entered findDay module")
        var day = record.get("Day")


        const hTxt = `I hope that was helpful. \n\nI'll be back with more updates tomorrow!.\n\n _powered by ekatra_`
        const btnTxt = "Finish Day"

        delay(1000).then(async () => {
            console.log("Delay of Finish Day")

            await adapter.continueConversation(conversationReferences[currentUser], async turnContext => {
                await sendInteractiveButtonsMessage(btnTxt, hTxt, turnContext).then().catch(e => console.log("FD Interactive message: " + e))
            }
            )
        })


    })
}


/**
 * 
 * @param {object} data - List options
 * @param {string} body - Body text of the hero card. 
 * @param {*} turnContext - Provides context for a turn of a bot
 */
async function createListMessage(data, body, turnContext) {

    const card = CardFactory.heroCard(
        body,
        [],
        data
    );
    const message = MessageFactory.attachment(card);
    await turnContext.sendActivity(message);
}


/**
 * 
 * @param {*} title - Button text
 * @param {string} body -  Body text of adaptive card.
 * @param {object} turnContext - Provides context for a turn of a bot
 */
async function sendInteractiveButtonsMessage(title, body, turnContext) {

    const card = CardFactory.adaptiveCard({
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.1",
        "body": [
            {
                "type": "TextBlock",
                "text": body,
                "size": "medium"
            }
        ],
        "actions": [
            {
                "type": "Action.Submit",
                "title": title,

                "data": {
                    "msteams": {
                        "type": "messageBack",
                        "displayText": title,
                        "text": title,
                        "value": title
                    }

                },

            }
        ]
    });

    const message = MessageFactory.attachment(card);
    await turnContext.sendActivity(message);

}

/**
 * Create a delay.
 * @param {number} time - time in milliseconds
 * @returns 
 */
const delay = (time) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
};


module.exports = { markDayComplete, sendModuleContent, markModuleComplete, store_responses }

