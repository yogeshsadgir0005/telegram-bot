import { User, IUser } from "../models/User";

export interface TelegramUserLike {
  id: number;
  username?: string;
  first_name?: string;
}

export async function getOrCreateUser(from: TelegramUserLike): Promise<IUser> {
  let user = await User.findOne({ telegramId: from.id });
  if (!user) {
    user = await User.create({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
    });
  }
  return user;
}
