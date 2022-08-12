
const { TeamsActivityHandler, CardFactory, TurnContext, MessageFactory } = require("botbuilder");
const rawWelcomeCard = require("./adaptiveCards/welcome.json");
const cardTools = require("@microsoft/adaptivecards-tools");
var Airtable = require('airtable');

const main = require("./main")
const airtable_method = require("./update")
require('dotenv').config("./env");

var base = new Airtable({ apiKey: process.env.apiKey }).base(process.env.base);

class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();

    /**
     * When the member is adds Microsoft Team App, Create a record in Airtable and send a message to capture the user's name.
     */
    this.onMembersAdded(async (context, next) => {

      let userID = context.activity.from.id

      await airtable_method.createRecord(userID, "").then(async (res) => {

        await context.sendActivity("Welcome to Ekatra MS TeamsBot 🎉")
        const card = cardTools.AdaptiveCards.declareWithoutData(rawWelcomeCard).render();

        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
        console.log(res)

      }).catch(err => console.log(err));

      await next();
    });

    this.onMessage(async (context, next) => {

      let txt = context.activity.text;
      // 
      let userID = context.activity.from.id
      let value = context.activity.value

      console.log(`txt = ${txt} by ${userID}`);

      // If user clicks cancel on the name adaptive card.
      if (txt == undefined && value) {
        if (Object.keys(value).length === 0) {

          const card = cardTools.AdaptiveCards.declareWithoutData(rawWelcomeCard).render();
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });

        }

        // When user sends submit button, update user name, and send a template message to the user to initiate the flow.
        else if (context.activity.value.name != undefined) {
          console.log(`Name value ${context.activity.value.name}`);

          let name = context.activity.value.name
          let number = context.activity.from.id

          const records_Student = await base('MS-Students').select({
            filterByFormula: `({Phone} = '${number}')`,
            view: "Grid view",

          }).all();
          records_Student.forEach(async function (record) {
            let id = record.id;

            await airtable_method.updateField(id, "Name", name)
              .then(async (res) => {
                console.log("res ", res)
                const card = CardFactory.adaptiveCard({
                  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                  "type": "AdaptiveCard",
                  "version": "1.1",
                  "body": [
                    {
                      "type": "TextBlock",
                      "text": `Hello ${name}! Welcome to the FREE business training program - WomenWill by SHEROES. \n\nClick below to start.`,
                      "size": "medium",
                      "wrap": true
                    }
                  ],
                  "actions": [
                    {
                      "type": "Action.Submit",
                      "title": "Start",

                      "data": {
                        "msteams": {
                          "type": "imBack",
                          "text": "Start",
                          "value": "Start"
                        }

                      },

                    }
                  ]
                });
                // Attach template card and it to the user.
                const message = MessageFactory.attachment(card);

                await context.sendActivity(message);
                await next()

              }).catch(err => console.log(`Error adding name ${err}`));

          })

        }

      }
      // Respond to the user, based on the incoming message received.
      else {
        console.log(`Incoming ${txt} by ${userID}`);

        switch (txt) {
          // Initiate the day.
          case "Start":
            console.log(`Executing  ${txt}`);
            await main.sendModuleContent(userID, context).then().catch(e => console.log("Error starting module" + e))
            break;
          // Continue sending modules..
          case "Next Module": {

            await main.markModuleComplete(userID, context).then().catch(e => console.log("Next Module " + e))
            break;
          }
          // End the day.
          case "Finish Day": {

            await main.markDayComplete(userID, context).then().catch(e => console.log("Finish day " + e))
            break;

          }
          default:
            console.log("text = " + txt)
            // Send other text messages to store_responses function to check if it is one of the options from the list message
            await main.store_responses(userID, txt, context).then().catch(e => console.log(" Error in store response " + e))

        }
      }
      //By calling next() you ensure that the next BotHandler is run.
      await next();

    });
  }


}

module.exports.TeamsBot = TeamsBot;
