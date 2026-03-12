# 账号切换字段需求文档

本文档说明四种账号类型（Google、GitHub、BuilderId、Enterprise）在**切换账号时实际写入 Kiro IDE 的字段**。

---

## Google 账号

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAAGlzmfwTIFYXBGo6MbK0Uc5tBAK36PSGN_DL9eMqd6wRi4qu7V4Bn_V27QZbGatQDfMcAyC2t5Ol98MWAcBkc0:MGYCMQD83+33KN2qKdRsmoD0HpJrtNQshb3JWn5VV5ga/Bp2TSZ6cpUm0pdP6NDEJlgL4noCMQC734N1hb1zOJ3O4NBm3Cca+t09oPShL0ORDhn91DT3FI4o+RdEpddBXzQvMZWU0Z8",
  "authMethod": "social",
  "expiresAt": "2026-01-23T16:14:04.053082400+00:00",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "provider": "Google",
  "refreshToken": "aorAAAAAGnRHpwTIubdiosK1deXVGirP0_o-tkmWYpyaO3zwx87mR_9LUu6rLPztQ79CFU6uQMbjuGEhosgc3Q5fEBkc0:MGUCMB8i5bq4tu58ByXXj8cCS7sXUFLWzDxuJ8ookvPh95EzBG1c0rqhWLTJhm6iEpb33gIxANE3XFAtK2CGF6N1PtKIhdMMUjNC84c/jcHQH7w3OI/6y/wC9hdT1CH9aGQQzcnIIA"
}
```

---

## GitHub 账号

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAAGlzmVUeI_8gaJNdgtyeBQfoAaIsy9_99WWHw8Y9V1qgs6-_Izr6wnZeQR1zHZOxNp_6FqJJ0QyRcHoeyIBkc0:MGQCMD+An+ZfQCjYd1p/E0yOCqUwEvK9/wTsJBU35MXa4qAecooBcRmqeW5nVoZWiKyWyQIwCbUHK7J4pOCSRACy4Iy57nU/Qn4fYwl6riQMH/lyb4u81VfFFHtQm6G2X4mG65Q8",
  "authMethod": "social",
  "expiresAt": "2026-01-23T16:14:48.790448100+00:00",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "provider": "Github",
  "refreshToken": "aorAAAAAGmrJCoVczruhi7H0sR_nA3vGjTquOXaNdPrpoOCAWXRGm0xSyaI1891eG0Wvh5MmOjaoKhuS9zQgD7-tIBkc0:MGUCMQDJzvBRAoT+o3N30nmQSZlQyI0gA8UgAZADXXyyZ7nMLrcKkgwddD5w/GbcSB682KACMGoVITeiZU6z6Y04dY10iTr1lOX3ywISgc5gLQsYQ6LCIeKZfJ3J2eyTzwNKMkpK9w"
}
```

---

## BuilderId 账号

**Token 文件**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "authMethod": "IdC",
  "clientIdHash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "expiresAt": "2026-01-23T15:55:14.153942900+00:00",
  "provider": "BuilderId",
  "refreshToken": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "region": "us-east-1"
}
```

**Client 文件**：`~/.aws/sso/cache/9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53.json`

```json
{
  "clientId": "LkndlEtWf81u16m15VfmMnVzLWVhc3QtMQ",
  "clientSecret": "eyJraWQiOiJrZXktMTU2NDAyODA5OSIsImFsZyI6IkhTMzg0In0.eyJzZXJpYWxpemVkIjoie1wiY2xpZW50SWRcIjp7XCJ2YWx1ZVwiOlwiTGtuZGxFdFdmODF1MTZtMTVWZm1NblZ6TFdWaGMzUXRNUVwifSxcImlkZW1wb3RlbnRLZXlcIjpudWxsLFwidGVuYW50SWRcIjpudWxsLFwiY2xpZW50TmFtZVwiOlwiS2lybyBBY2NvdW50IE1hbmFnZXJcIixcImJhY2tmaWxsVmVyc2lvblwiOm51bGwsXCJjbGllbnRUeXBlXCI6XCJQVUJMSUNcIixcInRlbXBsYXRlQXJuXCI6bnVsbCxcInRlbXBsYXRlQ29udGV4dFwiOm51bGwsXCJleHBpcmF0aW9uVGltZXN0YW1wXCI6MTc3NDY2MzIxOC43NDExNjE3MTksXCJjcmVhdGVkVGltZXN0YW1wXCI6MTc2Njg4NzIxOC43NDExNjE3MTksXCJ1cGRhdGVkVGltZXN0YW1wXCI6MTc2Njg4NzIxOC43NDExNjE3MTksXCJjcmVhdGVkQnlcIjpudWxsLFwidXBkYXRlZEJ5XCI6bnVsbCxcInN0YXR1c1wiOm51bGwsXCJpbml0aWF0ZUxvZ2luVXJpXCI6bnVsbCxcImVudGl0bGVkUmVzb3VyY2VJZFwiOm51bGwsXCJlbnRpdGxlZFJlc291cmNlQ29udGFpbmVySWRcIjpudWxsLFwiZXh0ZXJuYWxJZFwiOm51bGwsXCJzb2Z0d2FyZUlkXCI6bnVsbCxcInNjb3Blc1wiOlt7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29tcGxldGlvbnNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiY29tcGxldGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6YW5hbHlzaXNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiYW5hbHlzaXNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29udmVyc2F0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJjb252ZXJzYXRpb25zXCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOnRyYW5zZm9ybWF0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0cmFuc2Zvcm1hdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6dGFza2Fzc2lzdFwiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0YXNrYXNzaXN0XCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn1dLFwiYXV0aGVudGljYXRpb25Db25maWd1cmF0aW9uXCI6bnVsbCxcInNoYWRvd0F1dGhlbnRpY2F0aW9uQ29uZmlndXJhdGlvblwiOm51bGwsXCJlbmFibGVkR3JhbnRzXCI6bnVsbCxcImVuZm9yY2VBdXRoTkNvbmZpZ3VyYXRpb25cIjpudWxsLFwib3duZXJBY2NvdW50SWRcIjpudWxsLFwic3NvSW5zdGFuY2VBY2NvdW50SWRcIjpudWxsLFwidXNlckNvbnNlbnRcIjpudWxsLFwibm9uSW50ZXJhY3RpdmVTZXNzaW9uc0VuYWJsZWRcIjpudWxsLFwiYXNzb2NpYXRlZEluc3RhbmNlQXJuXCI6bnVsbCxcImlzQmFja2ZpbGxlZFwiOmZhbHNlLFwiaGFzSW5pdGlhbFNjb3Blc1wiOnRydWUsXCJhcmVBbGxTY29wZXNDb25zZW50ZWRUb1wiOmZhbHNlLFwiaXNFeHBpcmVkXCI6ZmFsc2UsXCJzc29TY29wZXNcIjpbXSxcImdyb3VwU2NvcGVzQnlGcmllbmRseUlkXCI6e1wiY29kZXdoaXNwZXJlclwiOlt7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6YW5hbHlzaXNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiYW5hbHlzaXNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29tcGxldGlvbnNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiY29tcGxldGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6dGFza2Fzc2lzdFwiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0YXNrYXNzaXN0XCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOnRyYW5zZm9ybWF0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0cmFuc2Zvcm1hdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29udmVyc2F0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJjb252ZXJzYXRpb25zXCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn1dfSxcInNob3VsZEdldFZhbHVlRnJvbVRlbXBsYXRlXCI6dHJ1ZSxcImhhc1JlcXVlc3RlZFNjb3Blc1wiOmZhbHNlLFwiY29udGFpbnNPbmx5U3NvU2NvcGVzXCI6ZmFsc2UsXCJpc1YxQmFja2ZpbGxlZFwiOmZhbHNlLFwiaXNWMkJhY2tmaWxsZWRcIjpmYWxzZSxcImlzVjNCYWNrZmlsbGVkXCI6ZmFsc2UsXCJpc1Y0QmFja2ZpbGxlZFwiOmZhbHNlfSJ9.S7MVVh0F-x6er5WTQTs9T051nQ8hIX_F2Y1z367ifjbGBpEbXGLgQc31wF_txJbw",
  "expiresAt": "2026-04-23T14:55:14.155591400+00:00"
}
```

---

## Enterprise 账号

**Token 文件**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAAGlzllwmet_r6NCXwX9f47uEl6x8R2IFaES87UoK2C_kt_CTCwhDx793ltv5P7a7D7X7IxML5gxIjZWKykBbg1:MGYCMQDlqT37HBa2RObtq/u9TsuhH8G7d1o6Us8NMmdel7xluASmT3kd59JFdK7xiuroN5wCMQDFaO1gK0ZOtFVNBDV81x/aF4ik4gHvbLSTSyNQP0kkcWt01DitdHzxpOWXucJ7ktI",
  "refreshToken": "aorAAAAAGnnhFcE-lz3fyoGmmOdc99Nsgu9iwWwPgFnjrNdUzYgUgn6BaZdtf3-Gxuu408sZqoLUkpfZRMhsqyUDABbg1:MGUCMQCV3aaHmN5XIL4M5kcFaitYAqiUVJxN2LcM76ecZTPdBtFCabIDkGGzEeoLvBbH1Q8CMDLxoqvL1DeYnZEssM3k4Dds2u/qQud788lI25dLiF0hZ34DprM4Pgpvfxu95gdsCw",
  "expiresAt": "2026-01-23T15:40:14.847Z",
  "clientIdHash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "authMethod": "IdC",
  "provider": "Enterprise",
  "region": "ap-southeast-2"
}
```

**Client 文件**：`~/.aws/sso/cache/9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53.json`

```json
{
  "clientId": "LkndlEtWf81u16m15VfmMnVzLWVhc3QtMQ",
  "clientSecret": "eyJraWQiOiJrZXktMTU2NDAyODA5OSIsImFsZyI6IkhTMzg0In0.eyJzZXJpYWxpemVkIjoie1wiY2xpZW50SWRcIjp7XCJ2YWx1ZVwiOlwiTGtuZGxFdFdmODF1MTZtMTVWZm1NblZ6TFdWaGMzUXRNUVwifSxcImlkZW1wb3RlbnRLZXlcIjpudWxsLFwidGVuYW50SWRcIjpudWxsLFwiY2xpZW50TmFtZVwiOlwiS2lybyBBY2NvdW50IE1hbmFnZXJcIixcImJhY2tmaWxsVmVyc2lvblwiOm51bGwsXCJjbGllbnRUeXBlXCI6XCJQVUJMSUNcIixcInRlbXBsYXRlQXJuXCI6bnVsbCxcInRlbXBsYXRlQ29udGV4dFwiOm51bGwsXCJleHBpcmF0aW9uVGltZXN0YW1wXCI6MTc3NDY2MzIxOC43NDExNjE3MTksXCJjcmVhdGVkVGltZXN0YW1wXCI6MTc2Njg4NzIxOC43NDExNjE3MTksXCJ1cGRhdGVkVGltZXN0YW1wXCI6MTc2Njg4NzIxOC43NDExNjE3MTksXCJjcmVhdGVkQnlcIjpudWxsLFwidXBkYXRlZEJ5XCI6bnVsbCxcInN0YXR1c1wiOm51bGwsXCJpbml0aWF0ZUxvZ2luVXJpXCI6bnVsbCxcImVudGl0bGVkUmVzb3VyY2VJZFwiOm51bGwsXCJlbnRpdGxlZFJlc291cmNlQ29udGFpbmVySWRcIjpudWxsLFwiZXh0ZXJuYWxJZFwiOm51bGwsXCJzb2Z0d2FyZUlkXCI6bnVsbCxcInNjb3Blc1wiOlt7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29tcGxldGlvbnNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiY29tcGxldGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6YW5hbHlzaXNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiYW5hbHlzaXNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29udmVyc2F0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJjb252ZXJzYXRpb25zXCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOnRyYW5zZm9ybWF0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0cmFuc2Zvcm1hdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6dGFza2Fzc2lzdFwiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0YXNrYXNzaXN0XCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn1dLFwiYXV0aGVudGljYXRpb25Db25maWd1cmF0aW9uXCI6bnVsbCxcInNoYWRvd0F1dGhlbnRpY2F0aW9uQ29uZmlndXJhdGlvblwiOm51bGwsXCJlbmFibGVkR3JhbnRzXCI6bnVsbCxcImVuZm9yY2VBdXRoTkNvbmZpZ3VyYXRpb25cIjpudWxsLFwib3duZXJBY2NvdW50SWRcIjpudWxsLFwic3NvSW5zdGFuY2VBY2NvdW50SWRcIjpudWxsLFwidXNlckNvbnNlbnRcIjpudWxsLFwibm9uSW50ZXJhY3RpdmVTZXNzaW9uc0VuYWJsZWRcIjpudWxsLFwiYXNzb2NpYXRlZEluc3RhbmNlQXJuXCI6bnVsbCxcImlzQmFja2ZpbGxlZFwiOmZhbHNlLFwiaGFzSW5pdGlhbFNjb3Blc1wiOnRydWUsXCJhcmVBbGxTY29wZXNDb25zZW50ZWRUb1wiOmZhbHNlLFwiaXNFeHBpcmVkXCI6ZmFsc2UsXCJzc29TY29wZXNcIjpbXSxcImdyb3VwU2NvcGVzQnlGcmllbmRseUlkXCI6e1wiY29kZXdoaXNwZXJlclwiOlt7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6YW5hbHlzaXNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiYW5hbHlzaXNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29tcGxldGlvbnNcIixcInN0YXR1c1wiOlwiSU5JVElBTFwiLFwiYXBwbGljYXRpb25Bcm5cIjpudWxsLFwiZnJpZW5kbHlJZFwiOlwiY29kZXdoaXNwZXJlclwiLFwidXNlQ2FzZUFjdGlvblwiOlwiY29tcGxldGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6dGFza2Fzc2lzdFwiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0YXNrYXNzaXN0XCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn0se1wiZnVsbFNjb3BlXCI6XCJjb2Rld2hpc3BlcmVyOnRyYW5zZm9ybWF0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJ0cmFuc2Zvcm1hdGlvbnNcIixcInR5cGVcIjpcIkltbXV0YWJsZUFjY2Vzc1Njb3BlXCIsXCJzY29wZVR5cGVcIjpcIkFDQ0VTU19TQ09QRVwifSx7XCJmdWxsU2NvcGVcIjpcImNvZGV3aGlzcGVyZXI6Y29udmVyc2F0aW9uc1wiLFwic3RhdHVzXCI6XCJJTklUSUFMXCIsXCJhcHBsaWNhdGlvbkFyblwiOm51bGwsXCJmcmllbmRseUlkXCI6XCJjb2Rld2hpc3BlcmVyXCIsXCJ1c2VDYXNlQWN0aW9uXCI6XCJjb252ZXJzYXRpb25zXCIsXCJ0eXBlXCI6XCJJbW11dGFibGVBY2Nlc3NTY29wZVwiLFwic2NvcGVUeXBlXCI6XCJBQ0NFU1NfU0NPUEVcIn1dfSxcInNob3VsZEdldFZhbHVlRnJvbVRlbXBsYXRlXCI6dHJ1ZSxcImhhc1JlcXVlc3RlZFNjb3Blc1wiOmZhbHNlLFwiY29udGFpbnNPbmx5U3NvU2NvcGVzXCI6ZmFsc2UsXCJpc1YxQmFja2ZpbGxlZFwiOmZhbHNlLFwiaXNWMkJhY2tmaWxsZWRcIjpmYWxzZSxcImlzVjNCYWNrZmlsbGVkXCI6ZmFsc2UsXCJpc1Y0QmFja2ZpbGxlZFwiOmZhbHNlfSJ9.S7MVVh0F-x6er5WTQTs9T051nQ8hIX_F2Y1z367ifjbGBpEbXGLgQc31wF_txJbw",
  "expiresAt": "2026-04-23T14:55:14.155591400+00:00"
}
```

**说明**：
- `clientIdHash` 通过 `start_url` 计算（如 `https://xxx.awsapps.com/start`）
- `start_url` 不写入文件，只用于计算 `clientIdHash`

---

## 字段对比

### Social 账号（Google、GitHub）

**Token 文件字段**：
```json
{
  "accessToken": "ya29.xxx 或 gho_xxx",
  "refreshToken": "aor_xxx",
  "expiresAt": "2024-01-27T12:00:00Z",
  "authMethod": "social",
  "provider": "Google 或 Github",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK (可选)"
}
```

### IdC 账号（BuilderId、Enterprise）

**Token 文件字段**：
```json
{
  "accessToken": "aoa_xxx",
  "refreshToken": "aor_xxx",
  "expiresAt": "2026-01-23T15:55:14.153942900+00:00",
  "authMethod": "IdC",
  "provider": "BuilderId 或 Enterprise",
  "region": "us-east-1 或其他区域",
  "clientIdHash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

**Client 文件字段**：
```json
{
  "clientId": "LkndlEtWf81u16m15VfmMnVzLWVhc3QtMQ",
  "clientSecret": "eyJraWQiOiJrZXktMTU2NDAyODA5OSIsImFsZyI6IkhTMzg0In0...",
  "expiresAt": "2026-04-23T14:55:14.155591400+00:00"
}
```

---

## 常见问题

### Q1: 为什么需要 clientIdHash？

**A**: `clientIdHash` 用于标识 Client 文件的文件名。计算方法（与 Kiro IDE 源码一致）：

```rust
fn calculate_client_id_hash(start_url: &str) -> String {
    let input = format!(r#"{{"startUrl":"{}"}}"#, start_url);
    let mut hasher = Sha1::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}
```

**关键点**：
- 使用 **SHA1**（不是 SHA256）
- 输入格式：`{"startUrl":"https://xxx.awsapps.com/start"}`（JSON 格式）
- BuilderId 使用固定 Start URL：`https://view.awsapps.com/start`
- Enterprise 使用账号的 `start_url` 字段

### Q2: 为什么 Enterprise 可能没有 email？

**A**: Enterprise 账号使用 AWS IAM Identity Center，配额响应中只有 `userId`，没有 `email` 字段。

### Q3: 字段名为什么要转换？

**A**: 账号管理器使用下划线格式（`access_token`），Kiro IDE 使用驼峰格式（`accessToken`）。切换账号时需要转换字段名。

### Q4: Client 文件的 expiresAt 是什么？

**A**: Client 文件的 `expiresAt` 是客户端注册的过期时间（通常是 90 天后），不是 Token 的过期时间。

---

## 相关文档

- `docs/dev-guides/account-structure.md` - Account 结构体字段说明
- `src-tauri/src/kiro.rs` - 切换账号实现
- `src-tauri/src/account.rs` - Account 结构体定义

---

## 更新记录

- 2026-01-27: 重写文档，聚焦切换账号时需要的字段


---

## 刷新 Token 请求与响应

### Social 账号（Google、GitHub）

**请求 API**：`POST https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken`

**请求体**：
```json
{
  "refreshToken": "aor_xxx"
}
```

**响应体**：
```json
{
  "accessToken": "aoaAAAAAGlzmfwTIFYXBGo6MbK0Uc5tBAK36PSGN_DL9eMqd6wRi4qu7V4Bn_V27QZbGatQDfMcAyC2t5Ol98MWAcBkc0:MGYCMQD83+33KN2qKdRsmoD0HpJrtNQshb3JWn5VV5ga/Bp2TSZ6cpUm0pdP6NDEJlgL4noCMQC734N1hb1zOJ3O4NBm3Cca+t09oPShL0ORDhn91DT3FI4o+RdEpddBXzQvMZWU0Z8",
  "refreshToken": "aorAAAAAGnRHpwTIubdiosK1deXVGirP0_o-tkmWYpyaO3zwx87mR_9LUu6rLPztQ79CFU6uQMbjuGEhosgc3Q5fEBkc0:MGUCMB8i5bq4tu58ByXXj8cCS7sXUFLWzDxuJ8ookvPh95EzBG1c0rqhWLTJhm6iEpb33gIxANE3XFAtK2CGF6N1PtKIhdMMUjNC84c/jcHQH7w3OI/6y/wC9hdT1CH9aGQQzcnIIA",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "expiresIn": 3600
}
```

---

### IdC 账号（BuilderId、Enterprise）

**请求 API**：`POST https://oidc.{region}.amazonaws.com/token`

**请求体**：
```json
{
  "clientId": "LkndlEtWf81u16m15VfmMnVzLWVhc3QtMQ",
  "clientSecret": "eyJraWQiOiJrZXktMTU2NDAyODA5OSIsImFsZyI6IkhTMzg0In0...",
  "grantType": "refresh_token",
  "refreshToken": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM"
}
```

**响应体**：
```json
{
  "accessToken": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "refreshToken": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "idToken": "eyJraWQiOiJ...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "aws_sso_app_session_id": "xxx-xxx-xxx",
  "issuedTokenType": "urn:ietf:params:oauth:token-type:access_token",
  "originSessionId": "xxx-xxx-xxx"
}
```

**说明**：
- `region` 必须与账号注册时使用的 region 一致
- `clientId` 和 `clientSecret` 从 Client 文件读取
- 响应中的 `idToken`、`aws_sso_app_session_id` 等字段可选

---


## 获取配额请求与响应

### 请求

**API**：`POST https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits`

**请求头**：
```
Content-Type: application/cbor
Accept: application/cbor
smithy-protocol: rpc-v2-cbor
authorization: Bearer {accessToken}
Cookie: Idp={provider}; AccessToken={accessToken}
```

**请求体（CBOR 编码）**：
```json
{
  "isEmailRequired": true,
  "origin": "KIRO_IDE"
}
```

---

### 响应（CBOR 编码）

#### Google/GitHub/BuilderId（免费版）

```json
{
  "daysUntilReset": 0,
  "limits": [],
  "nextDateReset": "2026-02-01T00:00:00+00:00",
  "overageConfiguration": {
    "overageEnabled": false
  },
  "subscriptionInfo": {
    "overageCapability": "OVERAGE_INCAPABLE",
    "subscriptionManagementTarget": "PURCHASE",
    "subscriptionTitle": "KIRO FREE",
    "type": "Q_DEVELOPER_STANDALONE_FREE",
    "upgradeCapability": "UPGRADE_CAPABLE"
  },
  "usageBreakdownList": [
    {
      "bonuses": [],
      "currency": "USD",
      "currentOverages": 0,
      "currentOveragesWithPrecision": 0.0,
      "currentUsage": 50,
      "currentUsageWithPrecision": 50.0,
      "displayName": "Credit",
      "displayNamePlural": "Credits",
      "freeTrialInfo": {
        "currentUsage": 500,
        "currentUsageWithPrecision": 500.0,
        "freeTrialExpiry": "2026-01-31T06:52:04.970000+00:00",
        "freeTrialStatus": "ACTIVE",
        "usageLimit": 500,
        "usageLimitWithPrecision": 500.0
      },
      "nextDateReset": "2026-02-01T00:00:00+00:00",
      "overageCap": 10000,
      "overageCapWithPrecision": 10000.0,
      "overageCharges": 0.0,
      "overageRate": 0.04,
      "resourceType": "CREDIT",
      "unit": "INVOCATIONS",
      "usageLimit": 50,
      "usageLimitWithPrecision": 50.0
    }
  ],
  "userInfo": {
    "email": "user@example.com",
    "userId": "d-9067c98495.14783408-d041-703f-20bc-39709c27f6f3"
  }
}
```

**关键字段**：
- `userInfo.email` - 用户邮箱（有）
- `userInfo.userId` - 用户 ID
- `usageBreakdownList[0].usageLimit` - 主配额限制（50）
- `usageBreakdownList[0].currentUsage` - 主配额已用
- `usageBreakdownList[0].freeTrialInfo` - 试用配额信息（500）
- `usageBreakdownList[0].bonuses` - 奖励配额列表

---

#### Enterprise（付费版）

```json
{
  "daysUntilReset": 0,
  "limits": [],
  "nextDateReset": "2026-02-01T00:00:00+00:00",
  "overageConfiguration": {
    "overageEnabled": false
  },
  "subscriptionInfo": {
    "overageCapability": "OVERAGE_CAPABLE",
    "subscriptionManagementTarget": "MANAGE",
    "subscriptionTitle": "KIRO POWER",
    "type": "Q_DEVELOPER_STANDALONE_POWER",
    "upgradeCapability": "UPGRADE_INCAPABLE"
  },
  "usageBreakdownList": [
    {
      "bonuses": [],
      "currency": "USD",
      "currentOverages": 0,
      "currentOveragesWithPrecision": 0.0,
      "currentUsage": 769,
      "currentUsageWithPrecision": 769.62,
      "displayName": "Credit",
      "displayNamePlural": "Credits",
      "nextDateReset": "2026-02-01T00:00:00+00:00",
      "overageCap": 10000,
      "overageCapWithPrecision": 10000.0,
      "overageCharges": 0.0,
      "overageRate": 0.04,
      "resourceType": "CREDIT",
      "unit": "INVOCATIONS",
      "usageLimit": 10000,
      "usageLimitWithPrecision": 10000.0
    }
  ],
  "userInfo": {
    "userId": "d-9767936181.c97e64c8-5011-709d-bf5b-d8401d5132d9"
  }
}
```

**关键差异**：
- ❌ `userInfo.email` - 无邮箱字段
- ✅ `userInfo.userId` - 只有用户 ID
- ✅ `usageLimit` - 主配额限制（10000）
- ❌ `freeTrialInfo` - 无试用配额

---

### 错误响应

#### 401 Unauthorized（Token 过期）

```json
{
  "__type": "UnauthorizedException",
  "message": "Token expired"
}
```

#### 403 Forbidden（Token 无效）

```json
{
  "reason": "INVALID_TOKEN",
  "message": "Invalid access token"
}
```

#### 403 Forbidden（账号封禁）

```json
{
  "reason": "TEMPORARILY_SUSPENDED",
  "message": "Your account has been temporarily suspended"
}
```

#### 423 Locked（账号封禁）

```json
{
  "__type": "AccountSuspendedException",
  "message": "Account suspended"
}
```

---
