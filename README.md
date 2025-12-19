# Rock‑Paper‑Scissors 

A web‑based **Rock‑Paper‑Scissors** game built using **Node.js**, **HTML**, **CSS**, and **JavaScript**.

This project allows users to play the classic Rock‑Paper‑Scissors game in their browser, with a lightweight server handling the application logic and static file serving.

---

##  Live Demo

Access the live version here:

- [https://rock-paper-scissors-tau-rose.vercel.app](https://rock-paper-scissors-tau-rose.vercel.app)

---

##  Game Rules

Rock‑Paper‑Scissors follows these simple rules:

| Move     | Beats    |
| -------- | -------- |
| Rock     | Scissors |
| Paper    | Rock     |
| Scissors | Paper    |

* Both player and computer choose a move
* The computer’s move is randomly generated
* The winner is decided instantly
* Draws are possible

---

##  Tech Stack

* **Node.js** – backend server
* **JavaScript** – game logic
* **HTML & CSS** – user interface
* **npm** – dependency management

---

## 📦 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/JENX-5/Rock-Paper-Scissors.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Rock-Paper-Scissors
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

---

## ▶️ Running the Game Locally

Start the server:

```bash
npm start
```

or

```bash
node server.js
```

Then open your browser and visit:

```
http://localhost:3000
```

*(Port may vary depending on configuration.)*

---

##  How to Play

1. Open the game in your browser
2. Choose **Rock**, **Paper**, or **Scissors**
3. The computer selects a move
4. The result is displayed instantly
5. Play again as many times as you like

---

## 👥 Multiplayer (Play With Friends)

You can play **Rock‑Paper‑Scissors with your friends** in multiple ways, depending on your network setup.

###  Local Network (LAN)

* Run the server on one machine
* Ensure both players are connected to the **same local network (Wi‑Fi / LAN)**
* Share the host machine’s **local IP address** (for example: `http://192.168.x.x:3000`)
* Open the link in both browsers and start playing together

###  Online Play (Port Forwarding / Tunneling Platforms)

The game can also be played with friends over the internet by exposing the local server using **secure tunneling or port‑forwarding platforms**.

These platforms generate a **temporary public URL** that forwards traffic to your local server, allowing players on different networks to connect and play together.

General steps:

1. Start the game server locally
2. Use a tunneling or port‑forwarding platform to expose the server
3. Share the generated **public URL** with your friend
4. Both players can now play together from different networks

>  The exact steps depend on the platform you choose, but the overall concept remains the same

---

## 📁 Project Structure

```
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server.js
├── package.json
├── node_modules/
└── README.md
```



##  License

This project is open‑source.

---

