// Providers 模块 - 认证提供者
// 参考 kiro-batch-login 的结构

mod base;
mod social;
mod idc;
mod factory;

pub use base::{AuthResult, AuthProvider, RefreshMetadata};
pub use social::SocialProvider;
pub use idc::IdcProvider;
pub use factory::*;
