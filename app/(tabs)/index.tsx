import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import ChessBoard from "../../src/components/ChessBoard";

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <StatusBar barStyle="light-content" />
      <ChessBoard />
    </SafeAreaView>
  );
}
