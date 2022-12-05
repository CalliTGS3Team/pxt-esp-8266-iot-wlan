/**
 * ESP8266 ESP-01S extension for calliope.
 * Serial interface.
 *
 * Fork from https://github.com/MKleinSB/pxt-esp-thingspeak 
 * 
 * @author Raik Andritschke
 *
 * Works with AZDelivery ESP8266 ESP-01S
 * Tested: Adafruit.IO and ThingSpeak 
 */

//% weight=2 color=#1174EE icon="\uf1eb" block="ESP8266"

enum ESP8266_LOGGING {
    //% block="OFF"
    //% block.loc.de="AUS"
    LOGGING_OFF,
    //% block="ON"
    //% block.loc.de="EIN"
    LOGGING_ON
}

namespace esp8266 {
  
    let isWifiConnected = false;
    let TX = SerialPin.C17;
    let RX = SerialPin.C16;
    let RATE = BaudRate.BaudRate115200;
    let LOGGING = ESP8266_LOGGING.LOGGING_OFF;
    let Initial = "r0h4ek/."
    let Schluessel = 3

    function logUSB(prefix: string, message: string): void {
        if (LOGGING == ESP8266_LOGGING.LOGGING_ON) {
            serial.redirectToUSB();
            serial.writeLine(prefix + " " + message);
            serial.redirect(TX, RX, RATE);
        }
    }

    function Passwort(): string {
        let passwort = ""
        for (let i=0; i < Initial.length; i++) {
            passwort = passwort + String.fromCharCode(Initial.charCodeAt(i) + Schluessel)
        }
        Schluessel = Schluessel + 1
        if (Schluessel > 10) Schluessel = 3
        return passwort;
    }

    /**
     * Setup Uart WiFi to connect to Wi-Fi
     */
    //% block="Setup Wifi|TX %txPin|RX %rxPin|Baud rate %baudrate|SSID = %ssid|Logging = %logging"
    //% block.loc.de="Mit dem WiFi Netzwerk verbinden|TX %txPin|RX %rxPin|Baud rate %baudrate|SSID = %ssid|Logging über USB = %logging"
    //% txPin.defl=SerialPin.C17
    //% rxPin.defl=SerialPin.C16
    //% baudRate.defl=BaudRate.BaudRate9600
    //% logging.defl=LOGGING_OFF
    export function setupWifi(txPin: SerialPin, rxPin: SerialPin, baudRate: BaudRate, ssid: string, logging:ESP8266_LOGGING) {
        let result = 0
        TX = txPin
        RX = rxPin
        RATE = baudRate
        LOGGING = logging

        isWifiConnected = false
        serial.redirect(
            TX,
            RX,
            RATE
        )
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)

        let passwd = Passwort()
        
        sendAtCmd("AT")
        result = waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd("AT+GMR")
        result = waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd("AT+CWMODE=1")
        result = waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd(`AT+CWJAP="${ssid}","${passwd}"`)
        result = waitAtResponse("WIFI GOT IP", "ERROR", "None", 5000)

        if (result == 1) {
            isWifiConnected = true

        }
    }

    function waitAtResponse(target1: string, target2: string, target3: string, timeout: number) {
        let buffer = ""
        let start = input.runningTime()

        while ((input.runningTime() - start) < timeout) {
            buffer += serial.readString()
        }    
            if (buffer.includes(target1)) { 
                logUSB('Response1',buffer)
                return 1
            }
            if (buffer.includes(target2)) {
                logUSB('Response2',buffer)
                return 2
            }
            if (buffer.includes(target3)) {
                logUSB('Response3',buffer)
                return 3
            }
//        }

        logUSB('Response0',buffer)
        return 0
    }

    function sendAtCmd(cmd: string) {
        serial.writeString(cmd + "\u000D\u000A")
    }

    /**
     * Check if WiFi is connected
     */
    //% block="Wifi OK?"
    export function wifiOK() {
        return isWifiConnected
    }

    /**
     * Disconnect from the wifi network.
     */
    //% block="Disconnect from wifi network"
    //% block.loc.de="Vom WiFi Netzwerk trennen"
    export function disconnect(): void {
        if (isWifiConnected) {
            sendAtCmd("AT+CWQAP")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }
    }

    /**
     * Send data to ThinkSpeak
     */
    //% block="Send Data to your ThinkSpeak Channel|Write API Key %apiKey|Field1 %field1|Field2 %field2|Field3 %field3|Field4 %field4|Field5 %field5|Field6 %field6|Field7 %field7|Field8 %field8"
    //% block.loc.de="Sende Daten an deinen ThinkSpeak Kanal|Write API Key %apiKey|Feld 1 %field1||Feld 2 %field2|Feld 3 %field3|Feld 4 %field4|Feld 5 %field5|Feld 6 %field6|Feld 7 %field7|Feld 8 %field8"
    //% expandableArgumentMode="enabled"
    //% apiKey.defl="your Write API Key"
    export function sendToThinkSpeak(apiKey: string, field1: number=0, field2: number=0, field3: number=0, field4: number=0, field5: number=0, field6: number=0, field7: number=0, field8: number=0) {
        let result = 0
        let retry = 2

        // close the previous TCP connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        while (isWifiConnected && retry > 0) {
            retry = retry - 1;
            // establish TCP connection
            sendAtCmd("AT+CIPSTART=\"TCP\",\"api.thingspeak.com\",80")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 2000)
            if (result == 3) continue

            let data = "GET /update?api_key=" + apiKey
            if (!isNaN(field1)) data = data + "&field1=" + field1
            if (!isNaN(field2)) data = data + "&field2=" + field2
            if (!isNaN(field3)) data = data + "&field3=" + field3
            if (!isNaN(field4)) data = data + "&field4=" + field4
            if (!isNaN(field5)) data = data + "&field5=" + field5
            if (!isNaN(field6)) data = data + "&field6=" + field6
            if (!isNaN(field7)) data = data + "&field7=" + field7
            if (!isNaN(field8)) data = data + "&field8=" + field8

            logUSB('Send data',data)

            sendAtCmd("AT+CIPSEND=" + (data.length + 2))
            // result = waitAtResponse(">", "OK", "ERROR", 2000)
            // if (result == 3) continue
            basic.pause(500)
            sendAtCmd(data)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)

            // // close the TCP connection
            // sendAtCmd("AT+CIPCLOSE")
            // waitAtResponse("OK", "ERROR", "None", 2000)

            if (result == 1) break
        }
    }

    /**
     * Send data to AdafruitIO
     */
    //% block="Send Data to your AdafruitIO Channel|Username %username|AdafruitIO Key %apiKey|Feed %feed|Value %value"
    //% block.loc.de="Sende Daten an deinen AdafruitIO Kanal|Benutzername %username|AdafruitIO Key %apiKey|Feed 1 %feed|Wert %value"
    //% expandableArgumentMode="enabled"
    //% adafruitIOKey.defl="your AdafruitIO Key"
    export function sendToAdafruitIO(username: string, adafruitIOKey: string, feed: string, value: string) {
        let result = 0
        let retry = 2

        // close the previous TCP connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        let body = "value=" + value
        let newline = "\u000D\u000A"

        while (isWifiConnected && retry > 0) {
            retry = retry - 1;
            // establish TCP connection
            logUSB('Establish TCP',"")
            sendAtCmd("AT+CIPSTART=\"TCP\",\"io.adafruit.com\",80,1")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 2000)
            if (result == 3) continue

            let data = "POST /api/v2/"+username+"/feeds/"+ feed +"/data"
            data = data + " HTTP/1.1"
            data = data + newline
            data = data + "Host: io.adafruit.com"
            data = data + newline
            data = data + "User-Agent: curl/7.83.1"
            data = data + newline
            data = data + "X-AIO-Key: " + adafruitIOKey
            data = data + newline
            data = data + "Content-Length: " + body.length.toString()
            data = data + newline
            data = data + "Content-Type: application/x-www-form-urlencoded"
            data = data + newline
            data = data + "Accept: */*"
            data = data + newline
            data = data + newline
            data = data + body

            logUSB('Send data',data)

            sendAtCmd("AT+CIPSEND=" + (data.length + 2).toString())
            // result = waitAtResponse(">", "OK", "ERROR", 2000)
            // if (result == 3) continue
            basic.pause(500)
            sendAtCmd(data)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)
            if (result == 3) continue
            
            // close the TCP connection
            logUSB('Close TCP',"")
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
            
            if (result == 1) break
        }
    }

    /**
     * Send data to IFTTT
     */
    //% block="Send Data to your IFTTT Event|Event %event|Key %key|value1 %value1||value2 %value2|value3 %value3"
    //% block.loc.de="Sende Daten an dein IFTTT Event|Event %event|Key %key|Wert 1 %value1|Wert 2 %value2|Wert 3 %value3"
    //% event.defl="your Event"
    //% key.defl="your Key"
    //% value1.defl="Hello"
    //% value2.defl="Calliope"
    //% value3.defl="mini"
    export function sendToIFTTT(event: string, key: string, value1: string, value2: string, value3: string) {
        let result = 0
        let retry = 2

        // close the previous TCP connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        while (isWifiConnected && retry > 0) {
            retry = retry - 1;
            // establish TCP connection
            sendAtCmd("AT+CIPSTART=\"TCP\",\"maker.ifttt.com\",80")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 2000)
            if (result == 3) continue

            let data = "GET /trigger/" + event + "/with/key/" + key
            data = data + "?value1=" + value1
            data = data + "&value2=" + value2
            data = data + "&value3=" + value3
            data = data + " HTTP/1.1"
            data = data + "\u000D\u000A"
            data = data + "User-Agent: curl/7.58.0"
            data = data + "\u000D\u000A"
            data = data + "Host: maker.ifttt.com"
            data = data + "\u000D\u000A"
            data = data + "Accept: */*"
            data = data + "\u000D\u000A"

            logUSB('Send data',data)

            sendAtCmd("AT+CIPSEND=" + (data.length + 2))
            // result = waitAtResponse(">", "OK", "ERROR", 2000)
            // if (result == 3) continue
            basic.pause(500)
            sendAtCmd(data)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)
            // close the TCP connection
            // sendAtCmd("AT+CIPCLOSE")
            // waitAtResponse("OK", "ERROR", "None", 2000)
            if (result == 1) break
        }
    }

}

