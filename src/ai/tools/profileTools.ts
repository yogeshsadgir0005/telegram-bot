import { registerTool } from "./registry";
import { User } from "../../db/models/User";

// Called whenever the user reveals something about themselves in normal
// conversation (not just during a fixed onboarding phase) — this is how the
// assistant "continues learning naturally" per the product's design intent,
// instead of front-loading a form.
registerTool({
  name: "update_user_profile",
  description:
    "Save something you've learned about the user from natural conversation: their role, interests, industries, companies they follow, or timezone. Call this any time the user mentions something worth remembering — not just at the start. Array fields are additive (new items merge with existing ones, no need to repeat what's already known).",
  parameters: {
    type: "object",
    properties: {
      role: { type: "string", description: "What the user does day-to-day." },
      addVerticals: { type: "array", items: { type: "string" }, description: "New interest verticals to add, e.g. ['technology']." },
      addTopics: { type: "array", items: { type: "string" }, description: "New topics/interests to track." },
      addIndustries: { type: "array", items: { type: "string" }, description: "New industries to track." },
      addCompanies: { type: "array", items: { type: "string" }, description: "New companies/tickers to track." },
      timezone: { type: "string", description: "IANA timezone, e.g. Asia/Kolkata, if the user mentions their location/timezone." },
    },
  },
  execute: async (
    args: {
      role?: string;
      addVerticals?: string[];
      addTopics?: string[];
      addIndustries?: string[];
      addCompanies?: string[];
      timezone?: string;
    },
    ctx
  ) => {
    const update: Record<string, unknown> = {};
    const addToSet: Record<string, unknown> = {};

    if (args.role) update.role = args.role;
    if (args.timezone) {
      update.timezone = args.timezone;
      update.timezoneConfirmed = true;
    }
    if (args.addVerticals?.length) addToSet.verticals = { $each: args.addVerticals.map((v) => v.toLowerCase()) };
    if (args.addTopics?.length) addToSet.topics = { $each: args.addTopics };
    if (args.addIndustries?.length) addToSet.industries = { $each: args.addIndustries };
    if (args.addCompanies?.length) addToSet.companiesFollowed = { $each: args.addCompanies.map((c) => c.toUpperCase()) };

    const ops: Record<string, unknown> = {};
    if (Object.keys(update).length) ops.$set = update;
    if (Object.keys(addToSet).length) ops.$addToSet = addToSet;
    if (Object.keys(ops).length === 0) return { updated: false };

    await User.updateOne({ telegramId: ctx.telegramId }, ops);
    return { updated: true };
  },
});
