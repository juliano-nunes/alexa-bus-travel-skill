// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const https = require('https');

const times = [
    {
       id: 'morning',
       startTime: 06,
       endTime: 12
    },
    {
        id: 'afternoon',
        startTime: 12,
        endTime: 18
    },
    {
        id: 'evening',
        startTime: 18,
        endTime: 00
    },
    {
        id: 'dawn',
        startTime: 00,
        endTime: 06
    }
];

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hoje é um ótimo dia para comprar sua passagem de ônibus, me diga para onde quer viajar.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const httpGet = function(origem, destino, departureDate) {
  return new Promise(((resolve, reject) => {
    var options = {
        host: 'alexa-testing.free.beeceptor.com',
        port: 443,
        path: `/api/v3/trips?from=${origem}&to=${destino}&departureDate=${departureDate}&clientId=2&returnDate=`,
        method: 'GET',
    };
    
    const request = https.request(options, (response) => {
      response.setEncoding('utf8');
      let returnData = '';

      response.on('data', (chunk) => {
        returnData += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(returnData));
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
    request.end();
  }));
};

const BuyTicketIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'BuyTicketIntent';
    },
    handle(handlerInput) {
        const origin = Alexa.getSlot(handlerInput.requestEnvelope, 'origin');
        const originId = origin.resolutions.resolutionsPerAuthority.filter(res => res.status.code === 'ER_SUCCESS_MATCH')[0].values[0]["value"].id;
        const destination = Alexa.getSlot(handlerInput.requestEnvelope, 'destination');
        const destinationId = destination.resolutions.resolutionsPerAuthority.filter(res => res.status.code === 'ER_SUCCESS_MATCH')[0].values[0]["value"].id;
        const departureDate = Alexa.getSlotValue(handlerInput.requestEnvelope, 'departureDate');
        
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        attributes.originId = originId;
        attributes.destinationId = destinationId;
        attributes.departureDate = departureDate;
        handlerInput.attributesManager.setSessionAttributes(attributes);

        return handlerInput.responseBuilder
            .speak(`Você prefere viajar pela manhã, a tarde, a noite ou de madrugada?`)
            .getResponse();
    }
};

const DepartureTimeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DepartureTimeIntent';
    },
    async handle(handlerInput) {
        const departureTime = Alexa.getSlot(handlerInput.requestEnvelope, 'departureTime');
        const departureTimeValue = Alexa.getSlotValue(handlerInput.requestEnvelope, 'departureTime');
        const departureTimeId = departureTime.resolutions.resolutionsPerAuthority.filter(res => res.status.code === 'ER_SUCCESS_MATCH')[0].values[0]["value"].id;

        const attributes = handlerInput.attributesManager.getSessionAttributes();
        attributes.departureTime = times.filter(time => time.id === departureTimeId)[0];
        handlerInput.attributesManager.setSessionAttributes(attributes);

        const response = await httpGet(attributes.originId, attributes.destinationId, attributes.departureDate);

        
        const departures = response.departures.filter(
            departure => {
                let hour = parseInt(departure.parts[0].departure.schedule.time.split(':')[0]);

                return attributes.departureTime.startTime < hour && attributes.departureTime.endTime > hour;
            }
        )
        .sort((a, b) => {
            if (a.price > b.price) {
                return -1;
            }
            if (b.price > a.price) {
                return 1;
            }
            return 0;
        });
        
        const cheapestTrip = departures[0].price;
        const serviceClass = departures[0].parts[0].bus.name;
        const terminal = departures[0].parts[0].departure.place.terminal;
        const timeHour = departures[0].parts[0].departure.schedule.time.split(':')[0];
        const timeMinutes = departures[0].parts[0].departure.schedule.time.split(':')[1];

        return handlerInput.responseBuilder
            .speak(`O menor preço encontrado no período da ${departureTimeValue} foi R$ ${cheapestTrip} na categoria ${serviceClass} saindo do ${terminal} às ${timeHour}:${timeMinutes}.`)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        BuyTicketIntentHandler,
        DepartureTimeIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();
