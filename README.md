# Transit Guardian

A smart transport disruption monitoring application designed for fixed route commuters.

## Problem Statement

Singapore's transport network works well on most days. However, when disruptions occur, commuters are often left to determine for themselves whether the disruption affects their journey and what alternative actions to take.

Most existing transport applications are reactive and generic, providing the same information to every user regardless of their commuting habits.

Transit Guardian aims to take a proactive approach by understanding a commuter's usual travel pattern and only providing alerts when a disruption has a meaningful impact on their journey.

## Target User

### Rachel - Fixed Schedule Commuter

Rachel travels from Tampines to Raffles Place via the East-West Line every weekday.

- Leaves home at 7:40 AM
- Needs to reach the office by 8:45 AM
- Has followed the same route for several years
- Does not actively check transport apps on normal days

For Rachel, minor delays are not important. However, significant disruptions can affect meetings and work commitments.

Transit Guardian focuses on notifying Rachel only when an incident is likely to impact her commute and provides clear guidance on what action to take.

## Live Demo

https://transit-guardian-angel.lovable.app/

## Demo Video

https://youtu.be/5u59cNqmxF8

## Screenshots

### Home Screen
- Display Rachel's daily commute overview, route status, and key transport information.

<img width="960" height="600" alt="Screenshot 2026-09-20 224450" src="https://github.com/user-attachments/assets/1e40c40b-0e88-49d6-b12b-75cbadc8420c" />

### Preference Page
- Allows commuters to configure routes, notification thresholds, travel preference.

<img width="960" height="600" alt="Screenshot 2026-09-20 224549" src="https://github.com/user-attachments/assets/9b9d1a19-7e09-4211-94fa-96e79418b8c0" />

### nearby MRT station and bus stop location, live bus arrival timing
- Tracks the commuter's location and highlights nearby MRT stations and Bus stops for convenient route planning.
- provides live arrival timings of busses serving the selected bus stop.

<img width="960" height="600" alt="Screenshot 2026-09-20 224614" src="https://github.com/user-attachments/assets/b0e4239b-845c-4af5-a205-623de6171927" />

### Disruption Alerts
- Highlights incidents, MRT disruptions, weather conditions and transport events that may impact the commute.

<img width="960" height="600" alt="Screenshot 2026-09-20 224642" src="https://github.com/user-attachments/assets/f05d26a0-6a4b-49de-900e-424134972565" />

### Simulate Page
- Simulates disruption scenarios and commute outcomes to evaluate the impact on Rachel's journey from Tampines to Raffles Place.

<img width="960" height="600" alt="Screenshot 2026-09-20 224701" src="https://github.com/user-attachments/assets/e027cbff-c12b-4cd4-9381-29c31924b842" />

## Features

- Route monitoring
- Bus arrival information
- MRT service status
- Traffic incident alerts
- Weather updates
- Journey simulation
- User route preferences

## Tech Stack

- React
- TypeScript
- Supabase
- Leaflet Maps
- Tailwind CSS

## Data Sources

Transit Guardian integrates real-time transport and disruption data through external APIs, including LTA DataMall services and Google Cloud APIs.

## Key Contributions

- Integrated and tested real-time API data sources through Google Cloud Console, LTA DataMall, and Postman
- Configured API authentication using API keys
- Assisted with deployment and cloud hosting setup
- Organized project documentation
- Documented application architecture and features

## Documentation

- ProjectOverview.md – Project goals and purpose.
- Features.md – Core features and functionality.
- Architecture.md – Component structure and application organization.
- google-cloud-deploy.md – Deployment setup and Google Cloud configuration.

## What I learned 

- Worked with real-time API integrations for the first time
- Configured and managed API keys through Google Cloud Console
- Retrieved live transport and disruption data from LTA DataMall
- Used Postman to test, validate, and debug API requests
- Integrated external data sources into a React and TypeScript application
- Learned how frontend applications consume and display live data

## Challenges Faced

- Understanding and integrating multiple API services
- Managing API authentication through API keys
- Working with real-time transport data
- Learning how to test API requests using Postman
- Understanding an existing codebase generated through Lovable

## Reflection

This project was my first experience working with real-time APIs and live transport data. Through the development of Transit Guardian, I learned how API keys are managed, how external data sources are tested and integrated, and how meaningful commuter alerts can be generated from live information. The project also gave me experience understanding and documenting an existing codebase rather than building everything from scratch.
