/*
     _       _                 _ _       ____                            _     _    _
  __| | ___ | | ___  _ __ ___ (_| |_ ___|  _ \ _   _ _ __ __ _ _ __ ___ (_) __| |  (_)___
 / _` |/ _ \| |/ _ \| '_ ` _ \| | __/ _ | |_) | | | | '__/ _` | '_ ` _ \| |/ _` |  | / __|
| (_| | (_) | | (_) | | | | | | | ||  __|  __/| |_| | | | (_| | | | | | | | (_| |_ | \__ \
 \__,_|\___/|_|\___/|_| |_| |_|_|\__\___|_|    \__, |_|  \__,_|_| |_| |_|_|\__,_(__/ |___/
                                               |___/                             |__/
This code works in conjunction with a couple of analog subsystems to "do things to" a nanopore.
The first analog subsystem is a voltage translator for a Keithley 480 picoammeter. The unit
has a 3-digit display plus sign and "mirrors" the LED display by providing a +/- 10v output 
through banana plugs in the back. Since +/- 10v in not something that most uControllers can
natively handle I made an analog circuit that remaps this +/- 10v output to 3.3v ~ 0v (the 
output in the back of the Keithley is inverted). This can be easily read by the ESP32
uController I am working with. So subsystem #1 is a voltage remapper. The second analog subsystem
takes the native analog output of the ESP32 DAC, which is 0 ~ 3.3v, and remaps that to +/- 1.65v.
*/
let leftMargin = 50; // 
let vSliderY = 50; // voltage slider package
let vSliderInc = 10; // voltage slider component spacing

let pSliderY = 140; // pulse slider package

let keithleyY = 240; // the text for the keithley buttons

let currentRadioButtons = [];
let labels = ['1nA', '10nA', '100nA', '1µA', '10µA', '100µA', '1mA'];

let voltageSlider;
let voltageInput;

let current = "Reading..."; // This is the "voltage" read from the ADS1115

let timeUnitLabels = ['µS', 'mS', 'S'];
let timeRadioButtons = [];
// Calculate positioning for the time radio buttons
let timeRadioStartX = 210; // place the buttons to the right of the control slider.
let timeRadioSpacing = 40;
/* 
 ____       _
/ ___|  ___| |_ _   _ _ __
\___ \ / _ | __| | | | '_ \
 ___) |  __| |_| |_| | |_) |
|____/ \___|\__|\__,_| .__/
                     |_|
*/

function setup() {
  createCanvas(800, 400);
  noLoop();

  // Calculate spacing based on canvas width
  let spacing = (width/2) / (labels.length + 1);

  for (let i = 0; i < labels.length; i++) {
    let x = (i+1) * spacing ;
    createCurrentRadioButton(labels[i], x);
  }
  
  // Create a voltage slider from 0 to 1.650 with steps of 1.650/255
  // 1) bottom range 2) top range 3) initial value 4) steps 
  voltageSlider = createSlider(-1.587, 1.587, 0, 3.174/256);
  voltageSlider.position(leftMargin, vSliderY + vSliderInc);
  voltageSlider.input(updateInputBox); // Update input box when the slider changes

  // Create an input box for the voltage slider
  voltageInput = createInput(voltageSlider.value().toString());
  voltageInput.position(leftMargin, vSliderY + vSliderInc * 4);
  voltageInput.size(50);
  voltageInput.input(updateSlider); // Update slider when the value in input box changes
  
  // Create a pulse slider from 1uS to 1S with steps of ?
  pSlider = createSlider(1, 1000, 0, 1);
  pSlider.position(leftMargin, pSliderY + vSliderInc);
  pSlider.input(updatePInputBox);
  
  // Create an input box for the pulse slider
  pInput = createInput(pSlider.value().toString());
  pInput.position(leftMargin, pSliderY + vSliderInc * 4);
  pInput.size(50);
  pInput.input(updatePSlider); // Update slider when the value in input box changes
  
  // create pulse control buttons sans "pulse"
  for (let i = 0; i < timeUnitLabels.length; i++) {
    let x = timeRadioStartX + i * timeRadioSpacing;
    let y = pSliderY;  // Fixed y position for all buttons
    createTimeRadioButton(timeUnitLabels[i], x, y);
  }
  // Create "pulse" after creating the time radio buttons
  createPulseButton('pulse', timeRadioStartX+100, pSliderY+10);
  // Initialize the settings in both the browser and the ESO32 to 
  // known values...
  // the time magnitude button:
  let microsecondRadioButton = timeRadioButtons[0];
    if(microsecondRadioButton) {
        microsecondRadioButton.elt.checked = true;
    }
  sendTimeDataToESP32();
  // the associated pSlider and box:
  pSlider.value(10);
  updatePInputBox();
  //sendPulseDataToESP32();
  // and set the Keithley buttons to 1nA:
  // currentRadioButtons[0].checked(true); // The '1nA' button is the first in the array
  sendCurrentDataToESP32();
  // and set the ESP32 voltage
  // Send the initial slider voltage value to the ESP
    let initialValue = voltageSlider.value();
    sendSliderVoltage(initialValue);
}
/*
 ____
|  _ \ _ __ __ ___      __
| | | | '__/ _` \ \ /\ / /
| |_| | | | (_| |\ V  V /
|____/|_|  \__,_| \_/\_/

*/
function draw() {
  background(250, 170, 170);

  stroke(0);   // Set stroke to black
  fill(0, 0, 0);   // Set fill to black
  strokeWeight(0);   // Reset stroke weight to default
  
  text("Voltage Control (-1.587V to 1.587V)", leftMargin, vSliderY);
  text("Pulse Width Control (1uS to 1S)", leftMargin, pSliderY);
  textAlign(CENTER);
  text("Keithley Front Panel Range Select", width/4, keithleyY);
  textAlign(LEFT);
  
  // Voltage sub-window 
  fill(255);
  rect(50, 300, 300, 45); // upper-left point ; x width, y width
  
  fill(0); // Setting color for text again
  text(`Current: ${current}A`, 70, 325);  // A is for Amperes, you can use other units if required.

  // the oscilloscope
  let newVoltageValue = getVoltageFromSource();
  let newCurrentValue = getCurrentFromADS1115();

  fill(0);
  let voltageRect = {x: 450, y:  30, w: 300, h: 150};
  let currentRect = {x: 450, y: 190, w: 300, h: 150};
  stroke(255, 255, 255); // Red border
  fill(0); // Black fill
  strokeWeight(3);   // Reset stroke weight to default
  rect(voltageRect.x, voltageRect.y, voltageRect.w, voltageRect.h);
  rect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);

  // Draw graticule
  drawGraticule(voltageRect);
  drawGraticule(currentRect);
  
  // Plot voltage values
  strokeWeight(1);
  drawSignal(voltageValues, voltageRect, color(0, 255, 0));

  // Plot current values
  drawSignal(currentValues, currentRect, color(255, 255, 0));
  addVoltageValue(newVoltageValue);
  addCurrentValue(newCurrentValue);
}

/*
 _____                 _   _
|  ____   _ _ __   ___| |_(_) ___  _ __  ___
| |_ | | | | '_ \ / __| __| |/ _ \| '_ \/ __|
|  _|| |_| | | | | (__| |_| | (_) | | | \__ \
|_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/

*/

function updateInputBox() {
  // voltageInput.value(voltageSlider.value());
  voltageInput.value(parseFloat(voltageSlider.value()).toFixed(4));
  sendSliderVoltage(voltageSlider.value());  // Send the value to ESP32
}

function updateSlider() {
  let val = voltageInput.value();
  if (val === "-") return; // If only a minus sign, do nothing and return

  val = parseFloat(val);

  // Ensuring values are within the slider's range
  if (val >= -1.65 && val <= 1.65) {
    voltageSlider.value(val);
    sendSliderVoltage(val);
  } else {
    alert("Please enter a value between -1.650 and 1.650");
    updateInputBox(); // Revert the input box to the slider's value
  }
}

function updatePInputBox() {
  pInput.value(pSlider.value());
}

function updatePSlider() { 
  let val = parseFloat(pInput.value());
  // You might want to add boundary checks as done previously for voltageInput
  if (val >= 0 && val <= 1000) { // Adjust boundaries as needed
    pSlider.value(val);
  } else {
    alert("Please enter a value within the appropriate range");
    updatePInputBox(); // Revert the input box to the slider's value
  }
}

function sendSliderVoltage(value) {
  let url = window.location.origin + '/setVoltage?value=' + value;
  httpGet(url, 'text', function(result) {
    console.log(result);  // Log the response from ESP32
  });
}

function getCurrent() {
    fetch('/getCurrent')
    .then(response => response.text())
    .then(data => {
        current = parseFloat(data);  // assuming the fetched data is a number in string format
        // The data is adjusted on the ESP32 side
        redraw();  // Update the canvas with the new value
    })
    .catch(error => {
        console.error('Error fetching current:', error);
    });
}


// Get voltage 16 times every second
setInterval(getCurrent, 63);


// 3-button time range selection button creation primitive
function createTimeRadioButton(labelText, x, y) {
    let div = createDiv('');
    div.style('position', 'absolute');
    div.style('text-align', 'center');
    
    let input = createElement('input');
    input.attribute('type', 'radio');
    input.attribute('name', 'radioGroup');
    input.changed(sendTimeDataToESP32);
    
    input.parent(div);
    
    let label = createSpan(labelText);
    label.parent(div);
    label.style('display', 'block');
    
    let divWidth = div.elt.offsetWidth;
    div.style('left', `${x - divWidth / 2}px`);
    div.style('top', `${y+10}px`);
    
    timeRadioButtons.push(input);
}

// the primitive that is called by the routine that makes buttons
// to display Keithley current ranges
function createCurrentRadioButton(labelText, x) { 
  let div = createDiv('');
  div.style('position', 'absolute');
  div.style('text-align', 'center');  // Center align the contents

  let input = createElement('input');
  input.attribute('type', 'radio');
  input.attribute('name', 'currentRadioGroup');  // Ensure all radios belong to the same group
  
  // Preset the radio button for "1nA" to be selected on initialization
  if (labelText === '1nA') {
    input.attribute('checked', 'true');
  }
  
  // Bind the event after defining the input
  input.changed(sendCurrentDataToESP32);

  input.parent(div);

  let label = createSpan(labelText);
  label.parent(div);
  label.style('display', 'block');  // Makes the label appear under the button
  
  // Adjusting for div width to center it on the x-coordinate
  let divWidth = div.elt.offsetWidth;
  div.style('left', `${x - divWidth / 2}px`);
  // div.style('top', `${height / 2}px`);
  div.style('top', `${keithleyY+20}px`);

  currentRadioButtons.push(input);  // Store the radio button
}

function sendCurrentDataToESP32() {
  let selectedValue = getSelectedCurrentValue();
  if (selectedValue !== null) {
    let mapValue = {
      '1nA': 0,
      '10nA': 1,
      '100nA': 2,
      '1µA': 3,
      '10µA': 4,
      '100µA': 5,
      '1mA': 6
    };
    
    let dataToSend = mapValue[selectedValue];
    let url = window.location.origin + '/setcurrentvalue?value=' + dataToSend;
    httpGet(url, 'text', function(result) {
      console.log(result);  // Log the response from ESP32
    });
  }
}

function sendTimeDataToESP32() {
    let selectedValue = getSelectedTimeValue();
  if (selectedValue !== null) {
    let mapValue = {
      'µS': 0,
      'mS': 1,
      'S': 2
    };
    
    let dataToSend = mapValue[selectedValue];
    let url = window.location.origin + '/settimerange?value=' + dataToSend;
    httpGet(url, 'text', function(result) {
      console.log(result);  // Log the response from ESP32
    });
  }
}

function getSelectedCurrentValue() {
    for (let i = 0; i < currentRadioButtons.length; i++) {
        if (currentRadioButtons[i].elt.checked) {
            return labels[i];
        }
    }
    return null;
}

function getSelectedTimeValue() {
    for (let i = 0; i < timeRadioButtons.length; i++) {
        if (timeRadioButtons[i].elt.checked) {
            return timeUnitLabels[i];
        }
    }
    return null;
}

function sendPulseToESP32() {
    let pulseWidthValue = pInput.value();
    let timeUnit = getSelectedTimeValue(); // This should return 'uS', 'mS', or 'S'
    let url = window.location.origin + `/pulseWasPressed?pulseWidth=${pulseWidthValue}&timeUnit=${timeUnit}`;
    httpGet(url, 'text', function(result) {
        console.log(result);
    });
}


function createPulseButton(labelText, x, y) {
    let pulseButton = createButton(labelText);
    pulseButton.position(x, y);
    pulseButton.mousePressed(sendPulseToESP32);  // Assuming you've defined this function
}

// this section prepares the voltage and current for the oscope 
let voltageValues = [];
let currentValues = [];
const maxValues = 300;  // Adjust based on your desired display width

function getCurrentFromADS1115() {
    // This is a mock function, you'd replace this with however you're getting data from your sensor
    let adjustedCurrent = current / 15;
    return adjustedCurrent; // random value between -1 and 1 for demonstration
}

function getVoltageFromSource() {
    // Mock function, replace with your method of getting the voltage
    let currentVoltageValue = voltageSlider.value();
    currentVoltageValue /= 1.587;
    return currentVoltageValue;
}

function drawGraticule(rect) {
  stroke(200); // Light grey color for graticule
  strokeWeight(1);
  drawingContext.setLineDash([1, 9]); // Set dash pattern

  for (let x = rect.x + 30; x < rect.x + rect.w; x += 30) { // Vertical lines
    line(x, rect.y, x, rect.y + rect.h);
  }
  for (let y = rect.y + 15; y < rect.y + rect.h; y += 30) { // Horizontal lines
    line(rect.x, y, rect.x + rect.w, y);
  }

  drawingContext.setLineDash([]); // Reset dash pattern
}

function drawSignal(values, region, col) {
    stroke(col);
    noFill();
    beginShape();
    for (let i = 0; i < values.length; i++) {
        let x = map(i, 0, values.length, region.x, region.x + region.w);
        let y = map(values[i], -1, 1, region.y + region.h, region.y);
        vertex(x, y);
    }
    endShape();
}

function addVoltageValue(value) {
    voltageValues.push(value);
    if (voltageValues.length > maxValues) {
        voltageValues.splice(0, 1);
    }
}

function addCurrentValue(value) {
    currentValues.push(value);
    if (currentValues.length > maxValues) {
        currentValues.splice(0, 1);
    }
}

/*
// Assuming you have these elements
let pulseButton;
let pulseDurationInput;

function setup() {
  // ... other setup code

  pulseButton = createButton('Send Pulse');
  pulseButton.position(10, 10);  // adjust the position as needed
  pulseButton.mousePressed(sendPulseDataToESP32);

  pulseDurationInput = createInput(''); // initial value is an empty string
  pulseDurationInput.position(10, 40);  // adjust the position as needed
}

function sendPulseDataToESP32() {
  let pulseDuration = pulseDurationInput.value();  // get the value from the input

  // Convert the pulse duration to integer or leave it as a string, depending on your needs
  let pulseDurationValue = parseInt(pulseDuration, 10);  // example of conversion to integer

  // Construct the URL to send the data to the ESP32
  let url = window.location.origin + '/settimevalue?value=' + pulseDurationValue;

  // Send the data to the ESP32
  httpGet(url, 'text', function(result) {
    console.log(result);  // Log the response from ESP32
  });
}

*/