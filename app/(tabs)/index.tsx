import React from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ChessBoard from "../../src/components/ChessBoard";

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <ChessBoard />
      </View>
    </SafeAreaView>
  );
}
