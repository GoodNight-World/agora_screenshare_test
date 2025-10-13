import { io } from "socket.io-client";

export function createChatSocket(BACKEND_URL) {
    // 채팅용 백엔드 소켓 연결
    const newSocket = io(`${BACKEND_URL}`, {
    transports: ['websocket'],
    secure: false
    });

    return newSocket;
}