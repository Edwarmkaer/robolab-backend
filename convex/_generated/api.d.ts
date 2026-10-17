/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as classrooms from "../classrooms.js";
import type * as demo from "../demo.js";
import type * as evaluations from "../evaluations.js";
import type * as explore from "../explore.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_attempts from "../lib/attempts.js";
import type * as lib_codes from "../lib/codes.js";
import type * as lib_demoData from "../lib/demoData.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_mailPolicy from "../lib/mailPolicy.js";
import type * as lib_mailer from "../lib/mailer.js";
import type * as lib_rules from "../lib/rules.js";
import type * as mail from "../mail.js";
import type * as passwordReset from "../passwordReset.js";
import type * as student from "../student.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  classrooms: typeof classrooms;
  demo: typeof demo;
  evaluations: typeof evaluations;
  explore: typeof explore;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/attempts": typeof lib_attempts;
  "lib/codes": typeof lib_codes;
  "lib/demoData": typeof lib_demoData;
  "lib/env": typeof lib_env;
  "lib/mailPolicy": typeof lib_mailPolicy;
  "lib/mailer": typeof lib_mailer;
  "lib/rules": typeof lib_rules;
  mail: typeof mail;
  passwordReset: typeof passwordReset;
  student: typeof student;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
