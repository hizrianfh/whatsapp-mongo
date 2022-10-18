import axios from "axios";

const instance = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "token-access": process.env.API_ACCESS_TOKEN,
  },
});

export default instance;
