# BurnerPhone-pre-MR1

## Overview

This repository contains the `dolomitePyramid.js` file, which is a crucial component of our Molecular Streaming Device project. This code was used for experiments in the fall of 2023, primarily for calibration with a commercial Keithley picoammeter. It forms the foundation of what will be shipped on the ESP32 microcontrollers in the MR1 Molecular Streaming Device.

## Context

It's important to note that this code predates our transition to custom preamp circuitry. Despite its age, it remains a valuable reference for understanding the core functionality of our system.

## Key Features

1. **Analog Subsystem Integration**: The code interfaces with two analog subsystems:
   - A voltage translator for a Keithley 480 picoammeter
   - A voltage remapper for the ESP32's DAC output

2. **User Interface**: Implements a graphical interface with:
   - Voltage and pulse width control sliders
   - Current range selection buttons mirroring the Keithley front panel
   - Time unit selection for pulse width

3. **Real-time Data Visualization**: Includes an oscilloscope-like display for voltage and current readings

4. **ESP32 Communication**: Facilitates data exchange with the ESP32 microcontroller for various parameters

5. **Responsive Design**: Adapts to different canvas sizes and layouts

## Functional Details

- **Voltage Control**: Allows precise voltage adjustments from -1.587V to 1.587V
- **Pulse Width Control**: Ranges from 1µS to 1S with variable time units
- **Current Range Selection**: Mimics Keithley picoammeter range settings (1nA to 1mA)
- **Data Sampling**: Retrieves current readings at 16Hz
- **Graphical Display**: Shows real-time voltage and current waveforms

## Future Development

This code will serve as the core for the ESP32 microcontrollers in the MR1 Molecular Streaming Device. However, it will undergo significant updates and optimizations to integrate with our custom preamp circuitry and meet the specific requirements of the MR1 device.

## Note to Developers

While this code provides a comprehensive overview of the system's functionality, please be aware that it is not the most current version. It is shared here for reference and to provide insights into the project's development history. Future versions will build upon this foundation, incorporating lessons learned and adapting to new hardware configurations.

## Access

This version of the code is publicly available on our GitHub organization page. We encourage interested parties to review it for a better understanding of our project's evolution and core concepts.# BurnerPhone
