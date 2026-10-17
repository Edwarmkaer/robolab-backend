import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import "./shared/ui/styles.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!url) throw new Error("Falta VITE_CONVEX_URL. Corre `npx convex dev` para configurarla.");

const convex = new ConvexReactClient(url);
const root = document.getElementById("root");
if (!root) throw new Error("No se encontró #root.");

createRoot(root).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
);
