"use strict";

/*
設定
*/

const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

window.client = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/*
プレイヤーID
*/

function getPlayerId() {

  let id = localStorage.getItem("player_id");

  if (!id) {

    id = prompt("プレイヤーIDを入力してください\n例：2-3-12-abcd");

    if (!id) {
      id = "guest";
    }

    localStorage.setItem("player_id", id);
  }

  return id;
}

window.getPlayerId = getPlayerId;

