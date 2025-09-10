import * as AgoraRTC from "agora-rtc-sdk-ng";
import React from "react";

// Agora 설정
const APP_ID = process.env.REACT_APP_AGORA_APP_ID; // 여기에 실제 App ID를 입력하세요
const TOKEN = process.env.REACT_APP_AGORA_APP_TEMP_TOKEN; // 테스트용으로는 null 사용 가능

export default function AgoraTest() {
  React.useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    console.log("client.on exists?", typeof client.on); // function 이면 정상
    // 여기까지 OK면 SDK는 정상 → react 래퍼 문제 범위로 축소
  }, []);

  return <div>Minimal SDK test</div>;
}