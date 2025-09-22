import React from "react";
import { Text, View } from "react-native";
import { game } from "../lib/chess";

export default function GameStatus({ turn }: { turn: "w" | "b" }) {
  const isMate = game.isCheckmate();
  const isDrawn = game.isStalemate() || game.isDraw();
  const isCheck = game.isCheck();

  let bg = "#2b2b2b";
  let text = "";
  if (isMate) {
    const winner = game.winner();
    bg = "#8b1e1e";
    text = winner === "draw" ? "Checkmate — Draw" : `Checkmate — ${winner === "w" ? "White" : "Black"} wins`;
  } else if (isDrawn) {
    bg = "#444";
    text = "Draw";
  } else {
    bg = isCheck ? "#c24c4c" : "#2b2b2b";
    text = `Turn: ${turn === "w" ? "White" : "Black"}${isCheck ? " — Check" : ""}`;
  }

  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: bg }}>
        <Text style={{ color: "#fff", fontWeight: "600" }}>{text}</Text>
      </View>
    </View>
  );
}
